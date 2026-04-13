/**
 * orderValidation — pure functions for validating new order form inputs.
 * Pure functions = easy to test without rendering anything.
 */

import dayjs from 'dayjs';
import type { NewOrderDraft } from '@/hooks/useOrders';

export interface ValidationErrors {
  customerId?: string;
  jobSiteId?: string;
  mixDesignId?: string;
  volume?: string;
  slump?: string;
  pourType?: string;
  requestedTime?: string;
}

/** Returns an errors object; empty object means the draft is valid. */
export function validateOrder(draft: Partial<NewOrderDraft>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.customerId) {
    errors.customerId = 'Customer is required.';
  }

  if (!draft.jobSiteId) {
    errors.jobSiteId = 'Job site is required.';
  }

  if (!draft.mixDesignId) {
    errors.mixDesignId = 'Mix design is required.';
  }

  if (!draft.pourType) {
    errors.pourType = 'Pour type is required.';
  }

  // Volume: 0.5 – 12 cubic yards (typical truck capacity range)
  if (draft.volume === undefined || draft.volume === null || String(draft.volume).trim() === '') {
    errors.volume = 'Volume is required.';
  } else if (draft.volume < 0.5) {
    errors.volume = 'Minimum load is 0.5 yd³.';
  } else if (draft.volume > 12) {
    errors.volume = 'Maximum load is 12 yd³ (one truck).';
  }

  // Slump: 2 – 10 inches (typical field range)
  if (draft.slump === undefined || draft.slump === null || String(draft.slump).trim() === '') {
    errors.slump = 'Slump is required.';
  } else if (draft.slump < 2) {
    errors.slump = 'Slump must be at least 2".';
  } else if (draft.slump > 10) {
    errors.slump = 'Slump cannot exceed 10".';
  }

  // Requested time must be in the future (or current day for hot loads)
  if (!draft.requestedTime) {
    errors.requestedTime = 'Requested delivery time is required.';
  } else {
    const requested = dayjs(draft.requestedTime);
    if (!requested.isValid()) {
      errors.requestedTime = 'Invalid date/time.';
    } else if (requested.isBefore(dayjs().subtract(5, 'minute'))) {
      // 5-minute grace to account for form fill time
      errors.requestedTime = 'Requested time must be in the future.';
    }
  }

  return errors;
}

/** Convenience: true when validateOrder returns no errors. */
export function isOrderValid(draft: Partial<NewOrderDraft>): boolean {
  return Object.keys(validateOrder(draft)).length === 0;
}
