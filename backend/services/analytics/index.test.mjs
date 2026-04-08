/**
 * Analytics Service — Unit Tests
 *
 * Strategy: mock the aurora-client and response shared layer modules, then
 * test handler logic without hitting real AWS. Each test controls exactly
 * what Aurora returns and asserts on the HTTP response the handler produces.
 *
 * Run: cd backend && node --experimental-vm-modules node_modules/.bin/jest services/analytics
 */

import { jest } from '@jest/globals';

// ─── Mock the shared layer modules ────────────────────────────────────────
// The shared layer lives at /opt/nodejs/ in Lambda — that path doesn't exist
// locally. We mock the module path before importing the handler.

const mockQuery = jest.fn();

jest.unstable_mockModule('/opt/nodejs/aurora-client.mjs', () => ({
  query: mockQuery,
  param: (name, value) => {
    if (value === null || value === undefined) {
      return { name, value: { isNull: true } };
    }
    if (typeof value === 'string') {
      return { name, value: { stringValue: value } };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { name, value: { longValue: value } }
        : { name, value: { doubleValue: value } };
    }
    if (typeof value === 'boolean') {
      return { name, value: { booleanValue: value } };
    }
    return { name, value: { stringValue: String(value) } };
  },
}));

jest.unstable_mockModule('/opt/nodejs/response.mjs', async () => {
  const actual = await import('../../layers/shared/nodejs/response.mjs');
  return actual;
});

// ─── Minimal event builder ────────────────────────────────────────────────

function event({ method = 'GET', resource, query = {} } = {}) {
  return {
    httpMethod: method,
    resource,
    pathParameters: null,
    queryStringParameters: query,
    body: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

let handler;

beforeAll(async () => {
  const mod = await import('./index.mjs');
  handler = mod.handler;
});

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── GET /analytics/volume ──────────────────────────────────────────────

describe('GET /analytics/volume', () => {
  const volumeEvent = (query = {}) =>
    event({ resource: '/analytics/volume', query });

  test('returns 400 when plantId is missing', async () => {
    const res = await handler(volumeEvent({ range: '7d' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/plantId is required/i);
  });

  test('returns 400 for invalid range format', async () => {
    const res = await handler(volumeEvent({ plantId: 'PLANT-001', range: 'abc' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/range must be/i);
  });

  test('returns 400 for range of 0 days', async () => {
    const res = await handler(volumeEvent({ plantId: 'PLANT-001', range: '0d' }));
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for range exceeding 365 days', async () => {
    const res = await handler(volumeEvent({ plantId: 'PLANT-001', range: '999d' }));
    expect(res.statusCode).toBe(400);
  });

  test('returns daily volume data from Aurora', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { date: '2026-04-01', volumeYards: '42.5' },
        { date: '2026-04-02', volumeYards: '38.0' },
      ],
      rowCount: 2,
    });

    const res = await handler(volumeEvent({ plantId: 'PLANT-001', range: '7d' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.plantId).toBe('PLANT-001');
    expect(body.range).toBe('7d');
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toEqual({ date: '2026-04-01', volumeYards: 42.5 });
    expect(body.data[1]).toEqual({ date: '2026-04-02', volumeYards: 38.0 });
  });

  test('returns empty data when no deliveries exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await handler(volumeEvent({ plantId: 'PLANT-001' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
  });

  test('defaults to 7d range when not specified', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await handler(volumeEvent({ plantId: 'PLANT-001' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.range).toBe('7d');

    // Verify the SQL was called with '7' as the days param
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    const daysParam = params.find(p => p.name === 'days');
    expect(daysParam.value.stringValue).toBe('7');
  });
});

// ─── GET /analytics/utilization ─────────────────────────────────────────

describe('GET /analytics/utilization', () => {
  const utilEvent = (query = {}) =>
    event({ resource: '/analytics/utilization', query });

  test('returns 400 when plantId is missing', async () => {
    const res = await handler(utilEvent());
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/plantId is required/i);
  });

  test('returns correct utilization shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 8, productiveCount: 5, utilizationPct: 63 }],
      rowCount: 1,
    });

    const res = await handler(utilEvent({ plantId: 'PLANT-001' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body).toEqual({
      plantId: 'PLANT-001',
      total: 8,
      productiveCount: 5,
      utilizationPct: 63,
      byStatus: {},
    });
  });

  test('returns zeros when plant has no trucks', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 0, productiveCount: 0, utilizationPct: 0 }],
      rowCount: 1,
    });

    const res = await handler(utilEvent({ plantId: 'PLANT-002' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.total).toBe(0);
    expect(body.utilizationPct).toBe(0);
  });

  test('handles empty result gracefully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await handler(utilEvent({ plantId: 'PLANT-001' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.total).toBe(0);
    expect(body.productiveCount).toBe(0);
    expect(body.utilizationPct).toBe(0);
  });
});

// ─── GET /analytics/cycle-times ─────────────────────────────────────────

describe('GET /analytics/cycle-times', () => {
  const cycleEvent = (query = {}) =>
    event({ resource: '/analytics/cycle-times', query });

  test('returns 400 when plantId is missing', async () => {
    const res = await handler(cycleEvent({ range: '7d' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/plantId is required/i);
  });

  test('returns 400 for invalid range', async () => {
    const res = await handler(cycleEvent({ plantId: 'PLANT-001', range: 'bad' }));
    expect(res.statusCode).toBe(400);
  });

  test('returns daily cycle time data with benchmark', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { date: '2026-04-01', avgMinutes: '72.3' },
        { date: '2026-04-02', avgMinutes: '85.1' },
        { date: '2026-04-03', avgMinutes: '68.0' },
      ],
      rowCount: 3,
    });

    const res = await handler(cycleEvent({ plantId: 'PLANT-001', range: '7d' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.plantId).toBe('PLANT-001');
    expect(body.range).toBe('7d');
    expect(body.benchmarkMinutes).toBe(90);
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toEqual({ date: '2026-04-01', avgMinutes: 72.3 });
  });

  test('returns empty data when no completed deliveries in range', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await handler(cycleEvent({ plantId: 'PLANT-001' }));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
    expect(body.benchmarkMinutes).toBe(90);
  });
});

// ─── Route dispatcher ───────────────────────────────────────────────────

describe('Route dispatcher', () => {
  test('returns 400 for unknown route', async () => {
    const res = await handler(event({ resource: '/analytics/unknown' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/route not found/i);
  });
});
