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

import { query, param } from '/opt/nodejs/aurora-client.mjs';

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
