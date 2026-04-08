/**
 * orderValidation.test.ts — unit tests for the pure validation functions.
 *
 * These tests run entirely without a browser/DOM (no rendering required).
 * This is an example of separating business logic from UI so it can be
 * tested cheaply and quickly.
 */

import dayjs from 'dayjs';
import { validateOrder, isOrderValid } from './orderValidation';

const FUTURE = dayjs().add(2, 'hour').toISOString();
const PAST   = dayjs().subtract(1, 'hour').toISOString();

const VALID_DRAFT = {
  customerId:    'CUST-001',
  customerName:  'ABC Construction',
  jobSiteId:     'SITE-001',
  jobSiteName:   'Downtown Tower',
  jobSiteAddress:'123 Main St, Austin, TX',
  mixDesignId:   'MIX-3000-LS',
  mixDesignName: '3000 PSI Limestone',
  psi:           3000,
  volume:        5,
  slump:         4,
  pourType:      'slab' as const,
  requestedTime: FUTURE,
  isHotLoad:     false,
};

describe('validateOrder', () => {
  test('returns no errors for a valid draft', () => {
    expect(validateOrder(VALID_DRAFT)).toEqual({});
  });

  test('requires customerId', () => {
    const errors = validateOrder({ ...VALID_DRAFT, customerId: '' });
    expect(errors.customerId).toBeDefined();
  });

  test('requires jobSiteId', () => {
    const errors = validateOrder({ ...VALID_DRAFT, jobSiteId: '' });
    expect(errors.jobSiteId).toBeDefined();
  });

  test('requires mixDesignId', () => {
    const errors = validateOrder({ ...VALID_DRAFT, mixDesignId: '' });
    expect(errors.mixDesignId).toBeDefined();
  });

  test('requires pourType', () => {
    const errors = validateOrder({ ...VALID_DRAFT, pourType: undefined as unknown as 'slab' });
    expect(errors.pourType).toBeDefined();
  });

  describe('volume', () => {
    test('rejects undefined volume', () => {
      expect(validateOrder({ ...VALID_DRAFT, volume: undefined as unknown as number }).volume).toBeDefined();
    });

    test('rejects volume below 0.5', () => {
      expect(validateOrder({ ...VALID_DRAFT, volume: 0.25 }).volume).toBeDefined();
    });

    test('rejects volume above 12', () => {
      expect(validateOrder({ ...VALID_DRAFT, volume: 13 }).volume).toBeDefined();
    });

    test('accepts volume at boundary 0.5', () => {
      expect(validateOrder({ ...VALID_DRAFT, volume: 0.5 }).volume).toBeUndefined();
    });

    test('accepts volume at boundary 12', () => {
      expect(validateOrder({ ...VALID_DRAFT, volume: 12 }).volume).toBeUndefined();
    });
  });

  describe('slump', () => {
    test('rejects slump below 2', () => {
      expect(validateOrder({ ...VALID_DRAFT, slump: 1 }).slump).toBeDefined();
    });

    test('rejects slump above 10', () => {
      expect(validateOrder({ ...VALID_DRAFT, slump: 11 }).slump).toBeDefined();
    });

    test('accepts slump at boundary 2', () => {
      expect(validateOrder({ ...VALID_DRAFT, slump: 2 }).slump).toBeUndefined();
    });
  });

  describe('requestedTime', () => {
    test('rejects missing requestedTime', () => {
      const errors = validateOrder({ ...VALID_DRAFT, requestedTime: '' });
      expect(errors.requestedTime).toBeDefined();
    });

    test('rejects invalid date string', () => {
      const errors = validateOrder({ ...VALID_DRAFT, requestedTime: 'not-a-date' });
      expect(errors.requestedTime).toBeDefined();
    });

    test('rejects time more than 5 minutes in the past', () => {
      const errors = validateOrder({ ...VALID_DRAFT, requestedTime: PAST });
      expect(errors.requestedTime).toBeDefined();
    });

    test('accepts time in the future', () => {
      const errors = validateOrder({ ...VALID_DRAFT, requestedTime: FUTURE });
      expect(errors.requestedTime).toBeUndefined();
    });
  });
});

describe('isOrderValid', () => {
  test('returns true for a valid draft', () => {
    expect(isOrderValid(VALID_DRAFT)).toBe(true);
  });

  test('returns false when any field is invalid', () => {
    expect(isOrderValid({ ...VALID_DRAFT, volume: 99 })).toBe(false);
  });
});
