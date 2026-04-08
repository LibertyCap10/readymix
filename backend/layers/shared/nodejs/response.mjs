/**
 * response.mjs — HTTP response helpers for Lambda + API Gateway
 *
 * API Gateway requires Lambda to return an object with { statusCode, headers, body }.
 * The body must be a JSON string (not an object). These helpers handle that
 * serialization and always attach CORS headers so browser fetch() calls succeed.
 *
 * Usage:
 *   import { ok, created, badRequest, notFound, serverError } from '/opt/nodejs/response.mjs';
 *
 *   return ok({ orders: [] });
 *   return badRequest('plantId is required');
 *   return notFound(`Order ${ticketId} not found`);
 */

// ─── CORS headers ─────────────────────────────────────────────────────────
// These are sent on EVERY response. API Gateway also handles preflight OPTIONS
// via the Cors block in template.yaml Globals, but we include headers here too
// so the response is correct even if a Lambda integration edge case bypasses
// the gateway-level CORS handling.
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

// ─── Response constructors ────────────────────────────────────────────────

/**
 * 200 OK — successful GET or PATCH
 * @param {object} data - the response body (will be JSON-serialized)
 */
export function ok(data) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * 201 Created — successful POST that created a new resource
 * @param {object} data - the created resource
 */
export function created(data) {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * 400 Bad Request — invalid input from the client
 * @param {string|object} message - error description or validation errors map
 */
export function badRequest(message) {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: 'Bad Request',
      message: typeof message === 'string' ? message : JSON.stringify(message),
    }),
  };
}

/**
 * 404 Not Found — the requested resource doesn't exist
 * @param {string} message - description of what wasn't found
 */
export function notFound(message) {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Not Found', message }),
  };
}

/**
 * 409 Conflict — the operation conflicts with current state
 * (e.g., invalid status transition, optimistic lock failure)
 * @param {string} message - conflict description
 */
export function conflict(message) {
  return {
    statusCode: 409,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Conflict', message }),
  };
}

/**
 * 500 Internal Server Error — unexpected server-side failure
 * @param {Error|string} err - the error (stack is logged, not returned to client)
 */
export function serverError(err) {
  // Log full error details server-side (visible in CloudWatch)
  console.error('[serverError]', err);
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Check CloudWatch logs for details.',
    }),
  };
}

// ─── Request parsing helpers ──────────────────────────────────────────────

/**
 * Safely parse a JSON request body. Returns null on any failure.
 * @param {object} event - Lambda event from API Gateway
 * @returns {object|null}
 */
export function parseBody(event) {
  try {
    return JSON.parse(event.body ?? '{}');
  } catch {
    return null;
  }
}

/**
 * Extract and normalize query string parameters. All values are strings in
 * API Gateway; callers should coerce as needed.
 * @param {object} event - Lambda event
 * @returns {object} - query params (never null)
 */
export function getQueryParams(event) {
  return event.queryStringParameters ?? {};
}

/**
 * Extract path parameters (e.g., {ticketId} from /orders/{ticketId}).
 * @param {object} event - Lambda event
 * @returns {object}
 */
export function getPathParams(event) {
  return event.pathParameters ?? {};
}
