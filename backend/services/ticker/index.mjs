/**
 * Ticker Service — EventBridge-triggered Lambda that advances the delivery lifecycle.
 *
 * Runs every 1 minute. For each active order with a stored timeline, compares
 * the current time against phase boundary timestamps and advances the order
 * (and its assigned truck) to the next status when the threshold has passed.
 *
 * Uses conditional DynamoDB updates for idempotency — if two invocations
 * overlap, only one wins each transition.
 *
 * Phase transitions handled:
 *   scheduled  → dispatched    (when now >= scheduledDepartureAt)
 *   dispatched → in_transit    (when now >= loadingCompletesAt)
 *   in_transit → pouring       (when now >= transitArrivalAt)
 *   pouring    → returning     (when now >= pourCompletesAt)
 *   returning  → complete      (when now >= returnArrivalAt)
 *
 * Also handles:
 *   - Cancelled orders with trucks still returning (cancellation.estimatedReturnAt)
 *   - Truck position interpolation during transit phases
 *   - Truck status sync on each transition
 */

import {
  ddb,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  Tables,
} from '/opt/nodejs/dynamo-client.mjs';

export async function handler() {
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  console.log(`[Ticker] Running at ${nowIso}`);

  try {
    // 1. Get all plants
    const plantsResult = await ddb.send(new ScanCommand({ TableName: Tables.plants }));
    const plants = plantsResult.Items ?? [];

    let transitioned = 0;
    let trucksFreed = 0;

    for (const plant of plants) {
      // 2. Query active orders for this plant
      const activeOrders = await getActiveOrders(plant.plantId);

      for (const order of activeOrders) {
        if (!order.timeline) continue; // No timeline = legacy order, skip

        const tl = order.timeline;
        const result = await processOrder(order, tl, plant, nowMs, nowIso);
        transitioned += result.transitioned;
        trucksFreed += result.trucksFreed;
      }

      // 3. Handle cancelled orders with trucks still returning
      const cancelledOrders = await getCancelledReturningOrders(plant.plantId);
      for (const order of cancelledOrders) {
        if (!order.cancellation?.estimatedReturnAt) continue;
        if (nowMs >= new Date(order.cancellation.estimatedReturnAt).getTime()) {
          await freeTruck(order.assignedTruckId, plant, nowIso);
          // Clear the cancellation return flag
          await ddb.send(new UpdateCommand({
            TableName: Tables.orders,
            Key: { plantId: order.plantId, orderDateTicket: order.orderDateTicket },
            UpdateExpression: 'SET cancellation.truckReturned = :tr, updatedAt = :now',
            ExpressionAttributeValues: { ':tr': true, ':now': nowIso },
          }));
          trucksFreed++;
        }
      }
    }

    console.log(`[Ticker] Done: ${transitioned} transitions, ${trucksFreed} trucks freed`);
    return { statusCode: 200, body: JSON.stringify({ transitioned, trucksFreed }) };
  } catch (err) {
    console.error('[Ticker] Error:', err);
    throw err;
  }
}

// ─── Process a single order ───────────────────────────────────────────────

async function processOrder(order, tl, plant, nowMs, nowIso) {
  let transitioned = 0;
  let trucksFreed = 0;

  // Determine which transition (if any) should happen
  let newStatus = null;
  let truckStatus = null;
  let truckLat = null;
  let truckLng = null;

  switch (order.status) {
    case 'scheduled':
      if (nowMs >= new Date(tl.scheduledDepartureAt).getTime()) {
        newStatus = 'dispatched';
        truckStatus = 'loading';
        truckLat = plant.latitude;
        truckLng = plant.longitude;
      }
      break;

    case 'dispatched':
      if (nowMs >= new Date(tl.loadingCompletesAt).getTime()) {
        newStatus = 'in_transit';
        truckStatus = 'in_transit';
        // Truck starts at plant
        truckLat = plant.latitude;
        truckLng = plant.longitude;
      } else {
        // Still loading — truck is at plant
        truckLat = plant.latitude;
        truckLng = plant.longitude;
      }
      break;

    case 'in_transit':
      if (nowMs >= new Date(tl.transitArrivalAt).getTime()) {
        newStatus = 'pouring';
        truckStatus = 'pouring';
        truckLat = order.jobSiteLatitude;
        truckLng = order.jobSiteLongitude;
      } else if (order.routeData?.coordinates) {
        // Interpolate position along route
        const startMs = new Date(tl.loadingCompletesAt).getTime();
        const endMs = new Date(tl.transitArrivalAt).getTime();
        const fraction = Math.min((nowMs - startMs) / (endMs - startMs), 1);
        const pos = interpolatePosition(order.routeData.coordinates, fraction);
        truckLat = pos.lat;
        truckLng = pos.lng;
      }
      break;

    case 'pouring':
      if (nowMs >= new Date(tl.pourCompletesAt).getTime()) {
        newStatus = 'returning';
        truckStatus = 'returning';
        truckLat = order.jobSiteLatitude;
        truckLng = order.jobSiteLongitude;
      } else {
        // Still pouring — truck at job site
        truckLat = order.jobSiteLatitude;
        truckLng = order.jobSiteLongitude;
      }
      break;

    case 'returning':
      if (nowMs >= new Date(tl.returnArrivalAt).getTime()) {
        newStatus = 'complete';
        truckStatus = 'available';
        truckLat = plant.latitude;
        truckLng = plant.longitude;
      } else if (order.routeData?.coordinates) {
        // Interpolate position on return (reversed route)
        const startMs = new Date(tl.returnDepartureAt).getTime();
        const endMs = new Date(tl.returnArrivalAt).getTime();
        const fraction = Math.min((nowMs - startMs) / (endMs - startMs), 1);
        // Reverse fraction for the return trip (going from end to start of coords)
        const pos = interpolatePosition(order.routeData.coordinates, 1 - fraction);
        truckLat = pos.lat;
        truckLng = pos.lng;
      }
      break;
  }

  // Apply status transition if due
  if (newStatus) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: Tables.orders,
        Key: { plantId: order.plantId, orderDateTicket: order.orderDateTicket },
        UpdateExpression: 'SET #st = :newStatus, updatedAt = :now, events = list_append(events, :newEvent)',
        ConditionExpression: '#st = :currentStatus',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':newStatus': newStatus,
          ':currentStatus': order.status,
          ':now': nowIso,
          ':newEvent': [{ timestamp: nowIso, eventType: newStatus, note: 'Auto-advanced by ticker' }],
        },
      }));
      transitioned++;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        // Already transitioned by another invocation — idempotent
        return { transitioned: 0, trucksFreed: 0 };
      }
      throw err;
    }
  }

  // Update truck position + status
  if (order.assignedTruckId && (truckLat != null || truckStatus)) {
    const truckUpdate = ['lastUpdated = :now'];
    const truckValues = { ':now': nowIso };

    if (truckStatus) {
      truckUpdate.push('currentStatus = :tst');
      truckValues[':tst'] = truckStatus;
    }
    if (truckLat != null) {
      truckUpdate.push('latitude = :lat, longitude = :lng');
      truckValues[':lat'] = truckLat;
      truckValues[':lng'] = truckLng;
    }

    // On complete, clear order association and increment loads
    if (newStatus === 'complete') {
      truckUpdate.push('currentOrderId = :null, currentJobSite = :null');
      truckValues[':null'] = null;
      trucksFreed++;
    }

    try {
      await ddb.send(new UpdateCommand({
        TableName: Tables.trucks,
        Key: { truckId: order.assignedTruckId },
        UpdateExpression: `SET ${truckUpdate.join(', ')}`,
        ExpressionAttributeValues: truckValues,
        ConditionExpression: 'attribute_exists(truckId)',
      }));
    } catch (err) {
      console.warn(`[Ticker] Failed to update truck ${order.assignedTruckId}:`, err.message);
    }
  }

  return { transitioned, trucksFreed };
}

// ─── Query helpers ────────────────────────────────────────────────────────

async function getActiveOrders(plantId) {
  const statuses = ['scheduled', 'dispatched', 'in_transit', 'pouring', 'returning'];
  const allOrders = [];

  for (const status of statuses) {
    const result = await ddb.send(new QueryCommand({
      TableName: Tables.orders,
      IndexName: 'status-index',
      KeyConditionExpression: 'plantId = :plantId AND #st = :status',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':plantId': plantId, ':status': status },
    }));
    allOrders.push(...(result.Items ?? []));
  }

  return allOrders;
}

async function getCancelledReturningOrders(plantId) {
  const result = await ddb.send(new QueryCommand({
    TableName: Tables.orders,
    IndexName: 'status-index',
    KeyConditionExpression: 'plantId = :plantId AND #st = :status',
    FilterExpression: 'attribute_exists(cancellation) AND (attribute_not_exists(cancellation.truckReturned) OR cancellation.truckReturned = :false)',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: {
      ':plantId': plantId,
      ':status': 'cancelled',
      ':false': false,
    },
  }));
  return result.Items ?? [];
}

async function freeTruck(truckId, plant, nowIso) {
  if (!truckId) return;
  try {
    await ddb.send(new UpdateCommand({
      TableName: Tables.trucks,
      Key: { truckId },
      UpdateExpression: 'SET currentStatus = :st, currentOrderId = :null, currentJobSite = :null, lastUpdated = :now, latitude = :lat, longitude = :lng',
      ExpressionAttributeValues: {
        ':st': 'available', ':null': null, ':now': nowIso,
        ':lat': plant.latitude, ':lng': plant.longitude,
      },
    }));
  } catch (err) {
    console.warn(`[Ticker] Failed to free truck ${truckId}:`, err.message);
  }
}

// ─── Position interpolation ──────────────────────────────────────────────
// Simplified version: linear interpolation along coordinate array by index.
// Matches the frontend's routeGeometry.ts interpolateAlongRoute logic.

function interpolatePosition(coordinates, fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  if (coordinates.length === 0) return { lng: 0, lat: 0 };
  if (f === 0) return { lng: coordinates[0][0], lat: coordinates[0][1] };
  if (f >= 1) {
    const last = coordinates[coordinates.length - 1];
    return { lng: last[0], lat: last[1] };
  }

  // Compute cumulative distances
  const cumDist = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const d = haversine(
      coordinates[i - 1][0], coordinates[i - 1][1],
      coordinates[i][0], coordinates[i][1],
    );
    cumDist.push(cumDist[i - 1] + d);
  }
  const totalDist = cumDist[cumDist.length - 1];
  const targetDist = f * totalDist;

  // Binary search for segment
  let lo = 0, hi = cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  const segLen = cumDist[hi] - cumDist[lo];
  const segFrac = segLen > 0 ? (targetDist - cumDist[lo]) / segLen : 0;

  return {
    lng: coordinates[lo][0] + segFrac * (coordinates[hi][0] - coordinates[lo][0]),
    lat: coordinates[lo][1] + segFrac * (coordinates[hi][1] - coordinates[lo][1]),
  };
}

function haversine(lng1, lat1, lng2, lat2) {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
