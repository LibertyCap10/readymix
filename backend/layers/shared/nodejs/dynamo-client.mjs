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
  pending:    ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'cancelled'],
  in_transit: ['pouring', 'cancelled'],
  pouring:    ['returning', 'cancelled'],
  returning:  ['complete'],
  complete:   [],
  cancelled:  [],
};

export function canTransition(fromStatus, toStatus) {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export const VALID_STATUSES = Object.keys(VALID_TRANSITIONS);
