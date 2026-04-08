/**
 * Analytics Service — Lambda handler for operational metrics
 *
 * Routes:
 *   GET /analytics/volume?plantId=PLANT-001&range=7d
 *   GET /analytics/utilization?plantId=PLANT-001
 *   GET /analytics/cycle-times?plantId=PLANT-001&range=7d
 *
 * Phase 5: Aurora PostgreSQL queries against delivery_history.
 * Uses RDS Data API via the shared aurora-client layer — no VPC, no pg driver.
 *
 * The route signatures and response shapes stay identical to Phase 4 —
 * only the internals changed from DynamoDB scans to SQL aggregations.
 */

// Lazy import to avoid module-load failures in SAM local
let _aurora;
async function aurora() {
  if (!_aurora) _aurora = await import('/opt/nodejs/aurora-client.mjs');
  return _aurora;
}


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
    if (method === 'GET' && path === '/analytics/volume')      return await getVolume(event);
    if (method === 'GET' && path === '/analytics/utilization') return await getUtilization(event);
    if (method === 'GET' && path === '/analytics/cycle-times') return await getCycleTimes(event);
    if (method === 'GET' && path === '/analytics/customers')   return await getCustomers(event);
    if (method === 'GET' && path === '/analytics/drivers')     return await getDrivers(event);

    return badRequest(`Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Analytics error:', JSON.stringify({
      error: err.message,
      stack: err.stack,
      event: { method, path },
    }));
    return serverError(err);
  }
}

// ─── GET /analytics/volume ────────────────────────────────────────────────
//
// Daily delivery volume aggregation from delivery_history.
// Response: { plantId, range, data: [{ date, volumeYards }, ...] }

async function getVolume(event) {
  const { plantId, range = '7d' } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const days = parseDayRange(range);
  if (!days) return badRequest('range must be in format Nd (e.g., 7d, 30d)');

  const { query, param } = await aurora();
  const { rows } = await query(
    `SELECT
       TO_CHAR(DATE(completed_at), 'YYYY-MM-DD') AS date,
       ROUND(SUM(volume_yards)::NUMERIC, 1)      AS "volumeYards"
     FROM delivery_history
     WHERE plant_id = (SELECT id FROM plants WHERE code = :plantId)
       AND completed_at >= NOW() - CAST(:days || ' days' AS INTERVAL)
       AND final_status = 'complete'
     GROUP BY DATE(completed_at)
     ORDER BY DATE(completed_at)`,
    [
      param('plantId', plantId),
      param('days', String(days)),
    ]
  );

  // Convert string values from Data API to numbers
  const data = rows.map(r => ({
    date: r.date,
    volumeYards: parseFloat(r.volumeYards) || 0,
  }));

  return ok({ plantId, range, data });
}

// ─── GET /analytics/utilization ───────────────────────────────────────────
//
// Fleet utilization based on delivery_history — what % of trucks were
// productively delivering in the last 24 hours.
// Response: { plantId, total, productiveCount, utilizationPct, byStatus }

async function getUtilization(event) {
  const { plantId } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const { query, param } = await aurora();
  const { rows } = await query(
    `WITH plant_trucks AS (
       SELECT COUNT(*) AS total
       FROM trucks
       WHERE plant_id = (SELECT id FROM plants WHERE code = :plantId)
         AND is_active = true
     ),
     recent_activity AS (
       SELECT COUNT(DISTINCT truck_id) AS trucks_used
       FROM delivery_history
       WHERE plant_id = (SELECT id FROM plants WHERE code = :plantId)
         AND completed_at >= NOW() - INTERVAL '24 hours'
         AND final_status = 'complete'
     )
     SELECT
       pt.total,
       ra.trucks_used AS "productiveCount",
       CASE WHEN pt.total > 0
         THEN ROUND((ra.trucks_used::NUMERIC / pt.total) * 100)
         ELSE 0
       END AS "utilizationPct"
     FROM plant_trucks pt, recent_activity ra`,
    [param('plantId', plantId)]
  );

  const row = rows[0] || { total: 0, productiveCount: 0, utilizationPct: 0 };

  return ok({
    plantId,
    total: Number(row.total) || 0,
    productiveCount: Number(row.productiveCount) || 0,
    utilizationPct: Number(row.utilizationPct) || 0,
    byStatus: {},
  });
}

// ─── GET /analytics/cycle-times ──────────────────────────────────────────
//
// Daily average cycle time from delivery_history.
// Response: { plantId, range, data: [{ date, avgMinutes }, ...], benchmarkMinutes }

async function getCycleTimes(event) {
  const { plantId, range = '7d' } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const days = parseDayRange(range);
  if (!days) return badRequest('range must be in format Nd (e.g., 7d, 30d)');

  const { query, param } = await aurora();
  const { rows } = await query(
    `SELECT
       TO_CHAR(DATE(completed_at), 'YYYY-MM-DD') AS date,
       ROUND(AVG(cycle_time_minutes), 1)          AS "avgMinutes"
     FROM delivery_history
     WHERE plant_id = (SELECT id FROM plants WHERE code = :plantId)
       AND completed_at >= NOW() - CAST(:days || ' days' AS INTERVAL)
       AND final_status = 'complete'
       AND cycle_time_minutes IS NOT NULL
     GROUP BY DATE(completed_at)
     ORDER BY DATE(completed_at)`,
    [
      param('plantId', plantId),
      param('days', String(days)),
    ]
  );

  const data = rows.map(r => ({
    date: r.date,
    avgMinutes: parseFloat(r.avgMinutes) || 0,
  }));

  return ok({
    plantId,
    range,
    data,
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

// ─── GET /analytics/customers ────────────────────────────────────────────
//
// Customer scorecard from the v_customer_scorecard view.

async function getCustomers(event) {
  const { plantId } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const { query, param } = await aurora();
  const { rows } = await query(
    `SELECT
       c.name,
       COUNT(dh.id)                            AS "totalOrders",
       ROUND(SUM(dh.volume_yards)::NUMERIC, 1) AS "totalVolume",
       ROUND(SUM(dh.total_price)::NUMERIC, 2)  AS "revenue",
       ROUND(AVG(dh.cycle_time_minutes), 1)    AS "avgCycleTime",
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE dh.was_on_time = true) / NULLIF(COUNT(*), 0),
         1
       ) AS "onTimePct",
       MAX(dh.completed_at)::TEXT              AS "lastDelivery"
     FROM delivery_history dh
     JOIN customers c ON dh.customer_id = c.id
     WHERE dh.plant_id = (SELECT id FROM plants WHERE code = :plantId)
       AND dh.final_status = 'complete'
     GROUP BY c.id, c.name
     ORDER BY SUM(dh.volume_yards) DESC`,
    [param('plantId', plantId)]
  );

  const customers = rows.map(r => ({
    name: r.name,
    totalOrders: Number(r.totalOrders) || 0,
    totalVolume: parseFloat(r.totalVolume) || 0,
    revenue: parseFloat(r.revenue) || 0,
    avgCycleTime: parseFloat(r.avgCycleTime) || 0,
    onTimePct: parseFloat(r.onTimePct) || 0,
    lastDelivery: r.lastDelivery,
  }));

  return ok({ plantId, customers });
}

// ─── GET /analytics/drivers ──────────────────────────────────────────────
//
// Driver performance leaderboard from delivery_history + drivers table.

async function getDrivers(event) {
  const { plantId } = getQueryParams(event);
  if (!plantId) return badRequest('plantId is required');

  const { query, param } = await aurora();
  const { rows } = await query(
    `SELECT
       d.first_name || ' ' || d.last_name     AS "name",
       COUNT(dh.id)                            AS "deliveries",
       ROUND(SUM(dh.volume_yards)::NUMERIC, 1) AS "totalVolume",
       ROUND(AVG(dh.cycle_time_minutes), 1)    AS "avgCycleTime",
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE dh.was_on_time = true) / NULLIF(COUNT(*), 0),
         1
       ) AS "onTimePct",
       p.name                                  AS "plant"
     FROM delivery_history dh
     JOIN drivers d ON dh.driver_id = d.id
     JOIN plants p ON dh.plant_id = p.id
     WHERE dh.plant_id = (SELECT id FROM plants WHERE code = :plantId)
       AND dh.final_status = 'complete'
     GROUP BY d.id, d.first_name, d.last_name, p.name
     ORDER BY COUNT(dh.id) DESC`,
    [param('plantId', plantId)]
  );

  const drivers = rows.map(r => ({
    name: r.name,
    deliveries: Number(r.deliveries) || 0,
    totalVolume: parseFloat(r.totalVolume) || 0,
    avgCycleTime: parseFloat(r.avgCycleTime) || 0,
    onTimePct: parseFloat(r.onTimePct) || 0,
    plant: r.plant,
  }));

  return ok({ plantId, drivers });
}
