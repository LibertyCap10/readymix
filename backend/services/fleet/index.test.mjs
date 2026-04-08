/**
 * Fleet Service — Unit Tests
 *
 * Tests the route dispatch logic and input validation.
 * DynamoDB interactions are tested via the shared layer tests in orders/index.test.mjs.
 *
 * Run: cd backend && node --experimental-vm-modules node_modules/.bin/jest services/fleet
 */

import { jest } from '@jest/globals';

// ─── Mock shared layer ─────────────────────────────────────────────────────

jest.unstable_mockModule('/opt/nodejs/dynamo-client.mjs', () => ({
  ddb: { send: jest.fn() },
  GetCommand:    class GetCommand    { constructor(i) { this.input = i; } },
  PutCommand:    class PutCommand    { constructor(i) { this.input = i; } },
  QueryCommand:  class QueryCommand  { constructor(i) { this.input = i; } },
  UpdateCommand: class UpdateCommand { constructor(i) { this.input = i; } },
  ScanCommand:   class ScanCommand   { constructor(i) { this.input = i; } },
  Tables: {
    orders: 'readymix-orders-dev',
    trucks: 'readymix-trucks-dev',
    plants: 'readymix-plants-dev',
  },
  canTransition: jest.fn(() => true),
  VALID_STATUSES: ['pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled'],
}));

jest.unstable_mockModule('/opt/nodejs/response.mjs', async () => {
  const actual = await import('../../layers/shared/nodejs/response.mjs');
  return actual;
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function event({ method = 'GET', resource = '/fleet', path = {}, query = {}, body = null } = {}) {
  return {
    httpMethod: method,
    resource,
    pathParameters: path,
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null,
  };
}

const sampleTruck = {
  truckId: 'TRUCK-101',
  truckNumber: '101',
  plantId: 'PLANT-001',
  currentStatus: 'available',
  lastUpdated: '2026-03-31T07:00:00Z',
  loadsToday: 1,
};

// ─── Tests ─────────────────────────────────────────────────────────────────

let handler;
let mockDdbModule;

beforeAll(async () => {
  mockDdbModule = await import('/opt/nodejs/dynamo-client.mjs');
  const mod = await import('./index.mjs');
  handler = mod.handler;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /fleet ────────────────────────────────────────────────────────────

describe('GET /fleet', () => {
  test('returns 400 when plantId is missing', async () => {
    const res = await handler(event({ query: {} }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/plantId is required/i);
  });

  test('returns 400 for invalid status filter', async () => {
    const res = await handler(event({ query: { plantId: 'PLANT-001', status: 'vroom' } }));
    expect(res.statusCode).toBe(400);
  });

  test('returns 200 with trucks array when DynamoDB succeeds', async () => {
    mockDdbModule.ddb.send.mockResolvedValue({ Items: [sampleTruck] });
    const res = await handler(event({ query: { plantId: 'PLANT-001' } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.trucks).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  test('returns 200 with empty array when no trucks found', async () => {
    mockDdbModule.ddb.send.mockResolvedValue({ Items: [] });
    const res = await handler(event({ query: { plantId: 'PLANT-002' } }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).trucks).toHaveLength(0);
  });

  test('filters by status when status param provided', async () => {
    mockDdbModule.ddb.send.mockResolvedValue({ Items: [sampleTruck] });
    const res = await handler(event({ query: { plantId: 'PLANT-001', status: 'available' } }));
    expect(res.statusCode).toBe(200);
    // Verify QueryCommand was called (not GetCommand)
    expect(mockDdbModule.ddb.send).toHaveBeenCalledTimes(1);
  });

  test('returns 500 when DynamoDB throws', async () => {
    mockDdbModule.ddb.send.mockRejectedValue(new Error('Table not found'));
    const res = await handler(event({ query: { plantId: 'PLANT-001' } }));
    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /fleet/{truckId} ─────────────────────────────────────────────────

describe('GET /fleet/{truckId}', () => {
  test('returns 404 when truck does not exist', async () => {
    mockDdbModule.ddb.send.mockResolvedValue({ Item: undefined });
    const res = await handler(event({
      resource: '/fleet/{truckId}',
      path: { truckId: 'TRUCK-999' },
    }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toMatch(/TRUCK-999/);
  });

  test('returns 200 with truck data when found', async () => {
    mockDdbModule.ddb.send.mockResolvedValue({ Item: sampleTruck });
    const res = await handler(event({
      resource: '/fleet/{truckId}',
      path: { truckId: 'TRUCK-101' },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).truckId).toBe('TRUCK-101');
  });
});

// ─── PATCH /fleet/{truckId}/status ────────────────────────────────────────

describe('PATCH /fleet/{truckId}/status', () => {
  test('returns 400 when body is null', async () => {
    const res = await handler(event({
      method: 'PATCH',
      resource: '/fleet/{truckId}/status',
      path: { truckId: 'TRUCK-101' },
    }));
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when status field is missing', async () => {
    const res = await handler(event({
      method: 'PATCH',
      resource: '/fleet/{truckId}/status',
      path: { truckId: 'TRUCK-101' },
      body: { currentOrderId: 'TKT-001' }, // status missing
    }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/status is required/i);
  });

  test('returns 400 for invalid status value', async () => {
    const res = await handler(event({
      method: 'PATCH',
      resource: '/fleet/{truckId}/status',
      path: { truckId: 'TRUCK-101' },
      body: { status: 'parked' }, // not a valid truck status
    }));
    expect(res.statusCode).toBe(400);
  });

  test('returns 404 when truck does not exist', async () => {
    // First ddb.send (GetCommand to verify truck exists) returns empty
    mockDdbModule.ddb.send.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(event({
      method: 'PATCH',
      resource: '/fleet/{truckId}/status',
      path: { truckId: 'TRUCK-999' },
      body: { status: 'available' },
    }));
    expect(res.statusCode).toBe(404);
  });

  test('returns 200 with updated truck after successful status update', async () => {
    const updatedTruck = { ...sampleTruck, currentStatus: 'loading' };
    // First call: GetCommand to verify truck exists
    mockDdbModule.ddb.send.mockResolvedValueOnce({ Item: sampleTruck });
    // Second call: UpdateCommand
    mockDdbModule.ddb.send.mockResolvedValueOnce({});
    // Third call: GetCommand to return updated item
    mockDdbModule.ddb.send.mockResolvedValueOnce({ Item: updatedTruck });

    const res = await handler(event({
      method: 'PATCH',
      resource: '/fleet/{truckId}/status',
      path: { truckId: 'TRUCK-101' },
      body: { status: 'loading', currentOrderId: 'TKT-123456' },
    }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).currentStatus).toBe('loading');
  });

  test('accepts all valid truck statuses', async () => {
    const validStatuses = ['available', 'loading', 'in_transit', 'pouring', 'returning', 'maintenance'];
    for (const status of validStatuses) {
      mockDdbModule.ddb.send
        .mockResolvedValueOnce({ Item: sampleTruck })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Item: { ...sampleTruck, currentStatus: status } });

      const res = await handler(event({
        method: 'PATCH',
        resource: '/fleet/{truckId}/status',
        path: { truckId: 'TRUCK-101' },
        body: { status },
      }));
      expect(res.statusCode).toBe(200);
    }
  });
});

// ─── Route dispatch ────────────────────────────────────────────────────────

describe('route dispatch', () => {
  test('returns 400 for unknown route', async () => {
    const res = await handler(event({
      method: 'DELETE',
      resource: '/fleet/{truckId}',
      path: { truckId: 'TRUCK-101' },
    }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/Route not found/);
  });
});
