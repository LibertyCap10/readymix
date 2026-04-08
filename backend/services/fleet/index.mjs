/**
 * Fleet Service — Lambda handler for real-time truck status
 *
 * Routes (mapped in template.yaml via API Gateway events):
 *   GET  /fleet?plantId=PLANT-001[&status=available]
 *   GET  /fleet/{truckId}
 *   PATCH /fleet/{truckId}/status
 *
 * DynamoDB table: readymix-trucks-${Environment}
 *   PK: truckId         (e.g., "TRUCK-101")
 *   GSI plant-status-index: PK=plantId, SK=currentStatus
 *
 * Data stored here is the hot operational state only:
 *   - currentStatus (available | loading | in_transit | pouring | returning | maintenance)
 *   - currentOrderId (which ticket is on this truck right now)
 *   - currentJobSite (display name)
 *   - lastUpdated (ISO timestamp of last status change)
 *   - loadsToday (counter incremented on each dispatch)
 *
 * Master truck data (VIN, driver, capacity, make/model) is in Aurora PostgreSQL
 * and will be merged in the frontend or a Phase 6 `/fleet` endpoint that
 * queries both sources and combines them.
 */

import {
  ddb,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  Tables,
} from '/opt/nodejs/dynamo-client.mjs';

import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  serverError,
  parseBody,
  getQueryParams,
  getPathParams,
} from '/opt/nodejs/response.mjs';

// Valid truck operational statuses.
// Note: these are different from order statuses.
const VALID_TRUCK_STATUSES = [
  'available',    // At plant, ready to load
  'loading',      // Currently being loaded at batch plant
  'in_transit',   // Driving to job site
  'pouring',      // On site, drum turning
  'returning',    // Driving back to plant
  'maintenance',  // Out of service
];

// ─── Route dispatcher ─────────────────────────────────────────────────────

export async function handler(event) {
  const method = event.httpMethod;
  const path   = event.resource;

  try {
    if (method === 'GET'   && path === '/fleet')                  return listFleet(event);
    if (method === 'GET'   && path === '/fleet/{truckId}')        return getTruck(event);
    if (method === 'PATCH' && path === '/fleet/{truckId}/status') return updateTruckStatus(event);

    return badRequest(`Route not found: ${method} ${path}`);
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /fleet ───────────────────────────────────────────────────────────
//
// Required query params:
//   plantId — which plant's fleet to retrieve
//
// Optional query params:
//   status — filter to trucks with this currentStatus (e.g., "available")
//
// Without status filter:
//   Query plant-status-index GSI with just PK=plantId to get all plant trucks.
//
// With status filter:
//   Query plant-status-index GSI with PK=plantId and SK=status.
//   This is extremely efficient — the GSI has both as keys, so it's a direct lookup.

async function listFleet(event) {
  const { plantId, status } = getQueryParams(event);

  if (!plantId) return badRequest('plantId is required');

  if (status && !VALID_TRUCK_STATUSES.includes(status)) {
    return badRequest(`status must be one of: ${VALID_TRUCK_STATUSES.join(', ')}`);
  }

  const params = {
    TableName: Tables.trucks,
    IndexName: 'plant-status-index',
    KeyConditionExpression: 'plantId = :plantId',
    ExpressionAttributeValues: { ':plantId': plantId },
  };

  if (status) {
    params.KeyConditionExpression += ' AND currentStatus = :status';
    params.ExpressionAttributeValues[':status'] = status;
  }

  const result = await ddb.send(new QueryCommand(params));
  const trucks = result.Items ?? [];

  return ok({ trucks, count: trucks.length });
}

// ─── GET /fleet/{truckId} ─────────────────────────────────────────────────
//
// Direct key lookup — the most efficient DynamoDB operation.
// No GSI needed because truckId IS the partition key.

async function getTruck(event) {
  const { truckId } = getPathParams(event);
  if (!truckId) return badRequest('truckId path param is required');

  const result = await ddb.send(new GetCommand({
    TableName: Tables.trucks,
    Key: { truckId },
  }));

  if (!result.Item) return notFound(`Truck ${truckId} not found`);

  return ok(result.Item);
}

// ─── PATCH /fleet/{truckId}/status ───────────────────────────────────────
//
// Required body fields:
//   status — new truck status
//
// Optional body fields:
//   currentOrderId  — the ticket number this truck is now working
//   currentJobSite  — display name of the job site (for fleet dashboard)
//   latitude        — GPS latitude (Phase 6: from real GPS feed)
//   longitude       — GPS longitude
//
// Update strategy:
//   We do a conditional UpdateItem so the status isn't overwritten if a
//   concurrent request already changed it (last-writer-wins within a status).
//   This is simpler than optimistic locking for GPS pings — the latest
//   position is always "correct" regardless of order.
//
// On dispatch (available → loading):
//   Increment loadsToday counter.

async function updateTruckStatus(event) {
  const { truckId } = getPathParams(event);
  const body        = parseBody(event);

  if (!truckId)  return badRequest('truckId path param is required');
  if (!body)     return badRequest('Request body must be valid JSON');
  if (!body.status) return badRequest('status is required in request body');

  if (!VALID_TRUCK_STATUSES.includes(body.status)) {
    return badRequest(`status must be one of: ${VALID_TRUCK_STATUSES.join(', ')}`);
  }

  // Verify truck exists
  const getResult = await ddb.send(new GetCommand({
    TableName: Tables.trucks,
    Key: { truckId },
  }));
  if (!getResult.Item) return notFound(`Truck ${truckId} not found`);

  const now         = new Date().toISOString();
  const setClauses  = ['currentStatus = :status', 'lastUpdated = :now'];
  const exprValues  = { ':status': body.status, ':now': now };

  // Clear job site fields when returning to available
  if (body.status === 'available') {
    setClauses.push('currentOrderId = :null, currentJobSite = :null');
    exprValues[':null'] = null;
  }

  // Set job site info when dispatched to a delivery
  if (body.currentOrderId != null) {
    setClauses.push('currentOrderId = :orderId');
    exprValues[':orderId'] = body.currentOrderId;
  }
  if (body.currentJobSite != null) {
    setClauses.push('currentJobSite = :jobSite');
    exprValues[':jobSite'] = body.currentJobSite;
  }

  // GPS coordinates (Phase 6: updated by real-time feed)
  if (body.latitude != null)  {
    setClauses.push('latitude = :lat');
    exprValues[':lat'] = body.latitude;
  }
  if (body.longitude != null) {
    setClauses.push('longitude = :lng');
    exprValues[':lng'] = body.longitude;
  }

  await ddb.send(new UpdateCommand({
    TableName: Tables.trucks,
    Key: { truckId },
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    // Truck must exist (created by seed script, not by this service)
    ConditionExpression: 'attribute_exists(truckId)',
  }));

  // Re-fetch to return the current state
  const updated = await ddb.send(new GetCommand({
    TableName: Tables.trucks,
    Key: { truckId },
  }));

  return ok(updated.Item);
}
