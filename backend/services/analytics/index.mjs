/**
 * Analytics Service — Lambda handler for operational metrics
 *
 * Routes:
 *   GET /analytics/volume?plantId=PLANT-001&range=7d
 *   GET /analytics/utilization?plantId=PLANT-001
 *   GET /analytics/cycle-times?plantId=PLANT-001
 *
 * Phase 4: DynamoDB-only aggregations (active orders, current fleet state).
 * Phase 5: Aurora replaces these with richer historical SQL queries using
 *           joins, window functions, and aggregate functions across delivery_history.
 *
 * The route signatures and response shapes stay identical between phases —
 * only the internals change. Frontend hooks need no updates.
 */

import {
  ddb,
  QueryCommand,
  ScanCommand,
  Tables,
} from '/opt/nodejs/dynamo-client.mjs';

import {
  ok,
  badRequest,
  serverError,
  getQueryParams,
} from '/opt/nodejs/response.mjs';

// ─── Route dispatcher ─────────────────────────────────────────────────────

export async function handler(event) {
  const method = event.httpMethod;
  const path   = event.resource;

  try {
    if (method === 'GET' && path === '/analytics/volume')      return getVolume(event);
    if (method === 'GET' && path === '/analytics/utilization') return getUtilization(event);
    if (method === 'GET' && path === '/analytics/cycle-times') return getCycleTimes(event);

    return badRequest(`Route not found: ${method} ${path}`);
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /analytics/volume ────────────────────────────────────────────────
//
// Phase 4: Scan the last `range` days of orders in DynamoDB and sum volume.
// Phase 5: Replace with Aurora SQL:
//   SELECT date_trunc('day', requested_time) as day, SUM(volume_yards)
//   FROM delivery_history WHERE plant_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'
//   GROUP BY day ORDER BY day;

async function getVolume(event) {
  const { plantId, range = '7d' } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const days = parseDayRange(range);
  if (!days) return badRequest('range must be in format Nd (e.g., 7d, 30d)');

  // Build date prefixes for the last N days
  const dateKeys = buildDateRange(days);

  // Query each date's orders from DynamoDB and sum volumes
  // (In Phase 5 this becomes a single Aurora aggregate query)
  const volumeByDay = [];

  for (const dateStr of dateKeys) {
    const result = await ddb.send(new QueryCommand({
      TableName: Tables.orders,
      KeyConditionExpression: 'plantId = :plantId AND begins_with(orderDateTicket, :datePrefix)',
      ExpressionAttributeValues: {
        ':plantId':    plantId,
        ':datePrefix': `${dateStr}#`,
      },
      // Only fetch volume field — reduces data transfer
      ProjectionExpression: 'volume, #st',
      ExpressionAttributeNames: { '#st': 'status' },
    }));

    const items = result.Items ?? [];
    const totalVolume = items
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.volume ?? 0), 0);

    volumeByDay.push({ date: dateStr, volumeYards: Math.round(totalVolume * 10) / 10 });
  }

  return ok({ plantId, range, data: volumeByDay });
}

// ─── GET /analytics/utilization ───────────────────────────────────────────
//
// Phase 4: Counts trucks by status from DynamoDB TrucksTable.
// Phase 5: Replace with Aurora SQL across delivery_history for % productive hours.

async function getUtilization(event) {
  const { plantId } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const result = await ddb.send(new QueryCommand({
    TableName: Tables.trucks,
    IndexName: 'plant-status-index',
    KeyConditionExpression: 'plantId = :plantId',
    ExpressionAttributeValues: { ':plantId': plantId },
    ProjectionExpression: 'currentStatus',
  }));

  const trucks = result.Items ?? [];
  const total  = trucks.length;

  if (total === 0) {
    return ok({ plantId, total: 0, byStatus: {}, utilizationPct: 0 });
  }

  // Count trucks by status
  const byStatus = {};
  for (const truck of trucks) {
    const s = truck.currentStatus ?? 'unknown';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  // "Productive" = actively working (loading, in_transit, pouring, returning)
  const productiveStatuses = ['loading', 'in_transit', 'pouring', 'returning'];
  const productiveCount = productiveStatuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0);
  const utilizationPct  = Math.round((productiveCount / total) * 100);

  return ok({ plantId, total, byStatus, productiveCount, utilizationPct });
}

// ─── GET /analytics/cycle-times ──────────────────────────────────────────
//
// Phase 4: Returns a stub response — cycle time requires completed order history
// which Phase 4 doesn't persist (orders are deleted when complete, not archived yet).
// Phase 5: Replace with Aurora window function query:
//   SELECT AVG(cycle_time_minutes) OVER (ORDER BY completed_at RANGE INTERVAL '1 day' PRECEDING)
//   FROM delivery_history WHERE plant_id = $1 ORDER BY completed_at;

async function getCycleTimes(event) {
  const { plantId, range = '7d' } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  // Phase 4 stub — returns empty data with a note explaining the limitation.
  // Phase 5 swaps this implementation with an Aurora query; the response shape is preserved.
  return ok({
    plantId,
    range,
    note: 'Cycle time analytics require delivery_history (Aurora). Available in Phase 5.',
    data: [],
    benchmarkMinutes: 90,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse "7d", "30d" → number of days. Returns null for invalid input.
 */
function parseDayRange(range) {
  const match = /^(\d+)d$/.exec(range);
  if (!match) return null;
  const days = parseInt(match[1], 10);
  return days >= 1 && days <= 365 ? days : null;
}

/**
 * Build an array of ISO date strings (YYYY-MM-DD) for the last N days,
 * ending today. Used to build DynamoDB SK prefix queries.
 * e.g., buildDateRange(3) → ['2026-03-29', '2026-03-30', '2026-03-31']
 */
function buildDateRange(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
