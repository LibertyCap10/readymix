/**
 * dynamo-client.mjs — DynamoDB Document Client wrapper
 *
 * Provides a pre-configured DynamoDBDocumentClient that all Lambda functions
 * can import without duplicating setup boilerplate. The Document Client handles
 * marshalling/unmarshalling between JavaScript objects and DynamoDB's typed
 * attribute format ({ S: "value" } → "value").
 *
 * Usage in Lambda handlers:
 *   import { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand }
 *     from '/opt/nodejs/dynamo-client.mjs';
 *
 *   const result = await ddb.send(new QueryCommand({ TableName: '...', ... }));
 *   // result.Items is already plain JS objects — no .S / .N unwrapping needed
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// ─── Client configuration ─────────────────────────────────────────────────

const region = process.env.REGION ?? process.env.AWS_REGION ?? 'us-east-1';

const rawClient = new DynamoDBClient({ region });

// translateConfig controls how Document Client handles number precision.
// marshallOptions:
//   convertEmptyValues: false — don't silently convert "" to null; let validation catch it
//   removeUndefinedValues: true — strip undefined fields instead of sending them
// unmarshallOptions:
//   wrapNumbers: false — return plain JS numbers (safe for our use case; no big integers)
export const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Re-export commands so handlers only need one import
export {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
};

// ─── Table name helpers ───────────────────────────────────────────────────

// Table names are injected at deploy time via environment variables set in
// template.yaml Globals. Centralizing them here prevents string typos
// and makes it easy to find every table reference in tests.
export const Tables = {
  orders: process.env.ORDERS_TABLE ?? 'readymix-orders-dev',
  trucks: process.env.TRUCKS_TABLE ?? 'readymix-trucks-dev',
  plants: process.env.PLANTS_TABLE ?? 'readymix-plants-dev',
};

// ─── Status transition validation ────────────────────────────────────────
// Mirrors the frontend's VALID_TRANSITIONS in useOrders.ts.
// Keeping the same map in both places makes it easy to verify consistency
// in code review.

const VALID_TRANSITIONS = {
  pending:    ['scheduled', 'cancelled'],
  scheduled:  ['dispatched', 'pending', 'cancelled'],
  dispatched: ['in_transit', 'pending', 'cancelled'],
  in_transit: ['pouring', 'pending', 'cancelled'],
  pouring:    ['returning', 'pending', 'cancelled'],
  returning:  ['complete'],
  complete:   [],
  cancelled:  [],
};

export function canTransition(fromStatus, toStatus) {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export const VALID_STATUSES = Object.keys(VALID_TRANSITIONS);

// ─── Timeline duration constants ─────────────────────────────────────────
// Used by the dispatch endpoint and ticker Lambda to compute delivery phases.

export const TIMELINE = {
  loadingDurationMs:    7 * 60 * 1000,     // 7 minutes at plant
  pourRateMsPerYard:    10 * 60 * 1000,    // 10 minutes per cubic yard
  minPourDurationMs:    5 * 60 * 1000,     // 5 minute floor
  bufferBetweenJobsMs:  15 * 60 * 1000,   // 15 minutes between jobs (wash, reload, pre-trip)
};

/**
 * Compute the full delivery timeline for an order being dispatched.
 *
 * @param {string} departureAt - ISO timestamp when truck leaves plant
 * @param {number} routeDurationSeconds - Mapbox driving estimate in seconds
 * @param {number} volumeYards - order volume in cubic yards
 * @returns {object} timeline with all phase boundary timestamps
 */
export function computeTimeline(departureAt, routeDurationSeconds, volumeYards) {
  const departure = new Date(departureAt).getTime();
  const loadingMs = TIMELINE.loadingDurationMs;
  const transitMs = routeDurationSeconds * 1000;
  const pourMs    = Math.max(TIMELINE.minPourDurationMs, volumeYards * TIMELINE.pourRateMsPerYard);

  const loadingCompletesAt  = departure + loadingMs;
  const transitArrivalAt    = loadingCompletesAt + transitMs;
  const pourCompletesAt     = transitArrivalAt + pourMs;
  const returnDepartureAt   = pourCompletesAt;
  const returnArrivalAt     = returnDepartureAt + transitMs;

  return {
    scheduledDepartureAt: new Date(departure).toISOString(),
    loadingCompletesAt:   new Date(loadingCompletesAt).toISOString(),
    transitArrivalAt:     new Date(transitArrivalAt).toISOString(),
    pourCompletesAt:      new Date(pourCompletesAt).toISOString(),
    returnDepartureAt:    new Date(returnDepartureAt).toISOString(),
    returnArrivalAt:      new Date(returnArrivalAt).toISOString(),
  };
}

/**
 * Compute a delivery timeline constrained by when the truck becomes available.
 * Used for multi-order scheduling where a truck's departure depends on returning
 * from a prior job + buffer time.
 *
 * @param {string} earliestAvailableAt - ISO timestamp when truck returns from prior job
 * @param {number} routeDurationSeconds - Mapbox driving estimate in seconds
 * @param {number} volumeYards - order volume in cubic yards
 * @returns {object} timeline with all phase boundary timestamps + constrainedDepartureAt
 */
export function computeConstrainedTimeline(earliestAvailableAt, routeDurationSeconds, volumeYards) {
  const availableMs = new Date(earliestAvailableAt).getTime();
  const departureMs = availableMs + TIMELINE.bufferBetweenJobsMs;
  const departureAt = new Date(departureMs).toISOString();

  const timeline = computeTimeline(departureAt, routeDurationSeconds, volumeYards);
  return {
    ...timeline,
    constrainedDepartureAt: departureAt,
  };
}

/**
 * Check whether a proposed schedule block conflicts with existing blocks.
 * Blocks conflict if their [departure, returnArrival] intervals overlap.
 *
 * @param {Array<{scheduledDepartureAt: string, returnArrivalAt: string}>} existingBlocks
 * @param {{scheduledDepartureAt: string, returnArrivalAt: string}} proposed
 * @returns {{conflict: boolean, overlappingTicket?: string}} result
 */
export function detectScheduleConflict(existingBlocks, proposed) {
  const pStart = new Date(proposed.scheduledDepartureAt).getTime();
  const pEnd   = new Date(proposed.returnArrivalAt).getTime();

  for (const block of existingBlocks) {
    const bStart = new Date(block.scheduledDepartureAt).getTime();
    const bEnd   = new Date(block.returnArrivalAt).getTime();

    // Two intervals overlap if one starts before the other ends and vice versa
    if (pStart < bEnd && pEnd > bStart) {
      return { conflict: true, overlappingTicket: block.ticketNumber };
    }
  }

  return { conflict: false };
}
