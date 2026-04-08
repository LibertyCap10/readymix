/**
 * DispatchGrid.test.tsx
 *
 * Tests focus on the data-shaping logic (buildGridRows, buildPinnedBottomRow)
 * rather than the AG Grid canvas internals (which are notoriously hard to test
 * in jsdom). This is intentional: see docs/review/05-react-patterns.md for an
 * explanation of the "test the model, not the grid" pattern.
 */

import { buildPinnedBottomRow, STATUS_DISPLAY_ORDER } from './columnDefs';
import type { Order } from '@/mocks/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    ticketNumber:       'TKT-001',
    plantId:            'PLANT-001',
    customerId:         'CUST-001',
    customerName:       'Test Co',
    jobSiteId:          'SITE-001',
    jobSiteName:        'Test Site',
    jobSiteAddress:     '1 Test St, Austin, TX',
    mixDesignId:        'MIX-3000-LS',
    mixDesignName:      '3000 PSI',
    psi:                3000,
    volume:             5,
    slump:              4,
    pourType:           'slab',
    requestedTime:      '2026-03-31T08:00:00.000Z',
    status:             'pending',
    isHotLoad:          false,
    events:             [],
    createdAt:          '2026-03-31T07:00:00.000Z',
    updatedAt:          '2026-03-31T07:00:00.000Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('STATUS_DISPLAY_ORDER', () => {
  test('starts with pending and ends with cancelled', () => {
    expect(STATUS_DISPLAY_ORDER[0]).toBe('pending');
    expect(STATUS_DISPLAY_ORDER[STATUS_DISPLAY_ORDER.length - 1]).toBe('cancelled');
  });

  test('includes all 7 statuses', () => {
    expect(STATUS_DISPLAY_ORDER).toHaveLength(7);
  });
});

describe('buildPinnedBottomRow', () => {
  test('returns empty array for empty orders', () => {
    expect(buildPinnedBottomRow([])).toHaveLength(0);
  });

  test('returns one summary row', () => {
    const orders = [makeOrder({ volume: 3 }), makeOrder({ volume: 4, ticketNumber: 'TKT-002' })];
    expect(buildPinnedBottomRow(orders)).toHaveLength(1);
  });

  test('sums volume correctly', () => {
    const orders = [
      makeOrder({ volume: 3.5 }),
      makeOrder({ volume: 4.5, ticketNumber: 'TKT-002' }),
    ];
    const [summary] = buildPinnedBottomRow(orders);
    expect((summary as { volume: number }).volume).toBeCloseTo(8.0);
  });

  test('shows total order count in ticketNumber field', () => {
    const orders = [makeOrder(), makeOrder({ ticketNumber: 'TKT-002' })];
    const [summary] = buildPinnedBottomRow(orders);
    expect((summary as { ticketNumber: string }).ticketNumber).toContain('2');
  });

  test('counts active orders (excludes complete + cancelled)', () => {
    const orders = [
      makeOrder({ status: 'pending' }),
      makeOrder({ ticketNumber: 'TKT-002', status: 'complete' }),
      makeOrder({ ticketNumber: 'TKT-003', status: 'cancelled' }),
    ];
    const [summary] = buildPinnedBottomRow(orders);
    // Only 1 active (pending); complete and cancelled are excluded
    expect((summary as { customerName: string }).customerName).toContain('1');
  });
});
