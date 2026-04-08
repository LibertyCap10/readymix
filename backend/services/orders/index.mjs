/**
 * Orders Service — Lambda handler for delivery ticket CRUD
 *
 * Routes (mapped in template.yaml via API Gateway events):
 *   GET  /orders?plantId=PLANT-001&date=2026-03-31[&status=pending]
 *   GET  /orders/{ticketId}?plantId=PLANT-001
 *   POST /orders
 *   PATCH /orders/{ticketId}
 *
 * DynamoDB table: readymix-orders-${Environment}
 *   PK: plantId         (e.g., "PLANT-001")
 *   SK: orderDateTicket (e.g., "2026-03-31#TKT-2026-0001")
 *   GSI status-index:   PK=plantId, SK=status
 *   GSI time-index:     PK=plantId, SK=requestedTime
 *
 * Phase 6: POST /orders will also validate customerId, mixDesignId, and
 * plantId against Aurora. For now it writes directly to DynamoDB.
 */

import {
  ddb,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  Tables,
  canTransition,
  VALID_STATUSES,
} from '/opt/nodejs/dynamo-client.mjs';

import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  serverError,
  parseBody,
  getQueryParams,
  getPathParams,
} from '/opt/nodejs/response.mjs';

// ─── Route dispatcher ─────────────────────────────────────────────────────

export async function handler(event) {
  const method = event.httpMethod;
  const path   = event.resource; // e.g., "/orders" or "/orders/{ticketId}"

  try {
    if (method === 'GET'   && path === '/orders')            return listOrders(event);
    if (method === 'GET'   && path === '/orders/{ticketId}') return getOrder(event);
    if (method === 'POST'  && path === '/orders')            return createOrder(event);
    if (method === 'PATCH' && path === '/orders/{ticketId}') return updateOrder(event);

    return badRequest(`Route not found: ${method} ${path}`);
  } catch (err) {
    return serverError(err);
  }
}

// ─── GET /orders ──────────────────────────────────────────────────────────
//
// Required query params:
//   plantId — which plant to query
//   date    — ISO date (YYYY-MM-DD), filters SK begins_with "date#"
//
// Optional query params:
//   status  — filter using GSI status-index instead of main table
//
// DynamoDB query strategy:
//   Without status → Query main table: PK=plantId, SK begins_with "date#"
//   With status    → Query GSI status-index: PK=plantId, SK=status
//                    then filter client-side by date (GSI can't combine date + status range)

async function listOrders(event) {
  const { plantId, date, status } = getQueryParams(event);

  if (!plantId) return badRequest('plantId is required');
  if (!date)    return badRequest('date is required (YYYY-MM-DD)');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return badRequest('date must be in YYYY-MM-DD format');
  }

  let items;

  if (status) {
    // Validate status value
    if (!VALID_STATUSES.includes(status)) {
      return badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Query by plant + status via GSI, then filter by date client-side.
    // This is intentional: DynamoDB can't do a multi-key range query across
    // different attributes in a single request.
    const result = await ddb.send(new QueryCommand({
      TableName: Tables.orders,
      IndexName: 'status-index',
      KeyConditionExpression: 'plantId = :plantId AND #st = :status',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':plantId': plantId, ':status': status },
    }));

    // Filter to the requested date (SK format: "YYYY-MM-DD#TKT-xxx")
    items = (result.Items ?? []).filter((o) => o.orderDateTicket?.startsWith(date));
  } else {
    // Query main table: all orders for a plant on a given date
    const result = await ddb.send(new QueryCommand({
      TableName: Tables.orders,
      KeyConditionExpression: 'plantId = :plantId AND begins_with(orderDateTicket, :datePrefix)',
      ExpressionAttributeValues: {
        ':plantId':    plantId,
        ':datePrefix': `${date}#`,
      },
    }));
    items = result.Items ?? [];
  }

  return ok({ orders: items, count: items.length });
}

// ─── GET /orders/{ticketId} ───────────────────────────────────────────────
//
// Required query params:
//   plantId — needed to form the primary key (PK=plantId, SK=date#ticketId)
//
// Required path params:
//   ticketId — e.g., "TKT-2026-0001"
//
// The SK is stored as "2026-03-31#TKT-2026-0001". We query by plantId + GSI
// if we don't have the full SK. Since the date is embedded in the ticket
// (requestedTime), Phase 6 callers can pass the date as a query param to
// do a direct PK+SK lookup. For now we use the time-index GSI.

async function getOrder(event) {
  const { ticketId } = getPathParams(event);
  const { plantId }  = getQueryParams(event);

  if (!plantId)  return badRequest('plantId query param is required');
  if (!ticketId) return badRequest('ticketId path param is required');

  // Query time-index GSI to find the order without needing the full SK.
  // In a high-volume system you'd pass date as a param and do PK+SK GetItem.
  // This approach is fine for a dispatch board with ~50 orders/day.
  const result = await ddb.send(new QueryCommand({
    TableName: Tables.orders,
    FilterExpression: 'ticketNumber = :ticketId',
    KeyConditionExpression: 'plantId = :plantId',
    ExpressionAttributeValues: {
      ':plantId':  plantId,
      ':ticketId': ticketId,
    },
  }));

  const order = result.Items?.[0];
  if (!order) return notFound(`Order ${ticketId} not found for plant ${plantId}`);

  return ok(order);
}

// ─── POST /orders ─────────────────────────────────────────────────────────
//
// Required body fields:
//   plantId, customerId, customerName, jobSiteId, jobSiteName, jobSiteAddress,
//   mixDesignId, mixDesignName, psi, volume, slump, pourType, requestedTime
//
// Optional body fields:
//   isHotLoad, notes
//
// Generates a ticketNumber and builds the SK from the requestedTime date.

async function createOrder(event) {
  const body = parseBody(event);
  if (!body) return badRequest('Request body must be valid JSON');

  // ── Validate required fields ──────────────────────────────────────────
  const required = [
    'plantId', 'customerId', 'customerName',
    'jobSiteId', 'jobSiteName', 'jobSiteAddress',
    'mixDesignId', 'mixDesignName', 'psi',
    'volume', 'slump', 'pourType', 'requestedTime',
  ];
  const missing = required.filter((f) => body[f] == null || body[f] === '');
  if (missing.length > 0) {
    return badRequest(`Missing required fields: ${missing.join(', ')}`);
  }

  // ── Validate numeric ranges ───────────────────────────────────────────
  const volume = Number(body.volume);
  const slump  = Number(body.slump);
  const psi    = Number(body.psi);
  if (isNaN(volume) || volume < 0.5 || volume > 12) {
    return badRequest('volume must be between 0.5 and 12 yd³');
  }
  if (isNaN(slump) || slump < 2 || slump > 10) {
    return badRequest('slump must be between 2 and 10 inches');
  }

  // ── Validate requestedTime ────────────────────────────────────────────
  const requestedDate = new Date(body.requestedTime);
  if (isNaN(requestedDate.getTime())) {
    return badRequest('requestedTime must be a valid ISO 8601 datetime');
  }

  // ── Build new order item ──────────────────────────────────────────────
  const now          = new Date().toISOString();
  const dateStr      = body.requestedTime.slice(0, 10); // "YYYY-MM-DD"
  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

  const newOrder = {
    // DynamoDB keys
    plantId:          body.plantId,
    orderDateTicket:  `${dateStr}#${ticketNumber}`,  // SK

    // Searchable fields (also projected on GSIs)
    ticketNumber,
    status:           'pending',
    requestedTime:    body.requestedTime,

    // Order data
    customerId:       body.customerId,
    customerName:     body.customerName,
    jobSiteId:        body.jobSiteId,
    jobSiteName:      body.jobSiteName,
    jobSiteAddress:   body.jobSiteAddress,
    mixDesignId:      body.mixDesignId,
    mixDesignName:    body.mixDesignName,
    psi,
    volume,
    slump,
    pourType:         body.pourType,
    isHotLoad:        body.isHotLoad ?? false,
    notes:            body.notes ?? null,

    // Audit / event log
    events: [
      { timestamp: now, eventType: 'pending', note: 'Order created' },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: Tables.orders,
    Item: newOrder,
    // Prevent accidental overwrites (ticket numbers are time-based, collisions unlikely)
    ConditionExpression: 'attribute_not_exists(plantId)',
  }));

  return created(newOrder);
}

// ─── PATCH /orders/{ticketId} ─────────────────────────────────────────────
//
// Supported operations (body fields, all optional):
//   status         — new status (must be a valid forward transition)
//   assignedTruckId, assignedTruckNumber, driverName — truck assignment
//   notes          — dispatcher notes
//
// Uses a conditional update expression to ensure we only write if the
// current status matches what we expect (optimistic concurrency).
// If the status has changed since the caller last fetched, returns 409.

async function updateOrder(event) {
  const { ticketId }           = getPathParams(event);
  const { plantId, date }      = getQueryParams(event);
  const body                   = parseBody(event);

  if (!body)     return badRequest('Request body must be valid JSON');
  if (!plantId)  return badRequest('plantId query param is required');
  if (!ticketId) return badRequest('ticketId path param is required');
  if (!date)     return badRequest('date query param is required (YYYY-MM-DD)');

  // Reconstruct the SK from the date + ticketId
  const orderDateTicket = `${date}#${ticketId}`;

  // ── Fetch current order ───────────────────────────────────────────────
  const getResult = await ddb.send(new GetCommand({
    TableName: Tables.orders,
    Key: { plantId, orderDateTicket },
  }));

  const current = getResult.Item;
  if (!current) return notFound(`Order ${ticketId} not found`);

  // ── Status transition validation ──────────────────────────────────────
  if (body.status != null) {
    if (!VALID_STATUSES.includes(body.status)) {
      return badRequest(`Invalid status: ${body.status}`);
    }
    if (!canTransition(current.status, body.status)) {
      return conflict(
        `Cannot transition order from "${current.status}" to "${body.status}". ` +
        `Valid next statuses: ${getValidNext(current.status).join(', ') || 'none'}`
      );
    }
  }

  // ── Build update expression ───────────────────────────────────────────
  const now             = new Date().toISOString();
  const setClauses      = ['updatedAt = :updatedAt'];
  const exprValues      = { ':updatedAt': now, ':currentStatus': current.status };
  const exprNames       = {};

  if (body.status != null) {
    setClauses.push('#st = :status');
    exprNames['#st']     = 'status';
    exprValues[':status'] = body.status;

    // Append to event log
    const newEvent = {
      timestamp: now,
      eventType: body.status,
      note: body.note ?? undefined,
    };
    setClauses.push('events = list_append(events, :newEvent)');
    exprValues[':newEvent'] = [newEvent];
  }

  if (body.assignedTruckId != null) {
    setClauses.push('assignedTruckId = :truckId, assignedTruckNumber = :truckNumber, driverName = :driverName');
    exprValues[':truckId']     = body.assignedTruckId;
    exprValues[':truckNumber'] = body.assignedTruckNumber ?? '';
    exprValues[':driverName']  = body.driverName ?? '';
  }

  if (body.notes != null) {
    setClauses.push('notes = :notes');
    exprValues[':notes'] = body.notes;
  }

  // Optimistic lock: only update if status hasn't changed since we fetched
  const conditionExpression = body.status != null
    ? '#st = :currentStatus'
    : 'attribute_exists(plantId)';
  if (body.status != null) {
    exprNames['#st'] = 'status';
  }

  await ddb.send(new UpdateCommand({
    TableName: Tables.orders,
    Key: { plantId, orderDateTicket },
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ConditionExpression: conditionExpression,
    ExpressionAttributeValues: exprValues,
    ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
  }));

  // Return the updated order by re-fetching (ensures response reflects DB state)
  const updated = await ddb.send(new GetCommand({
    TableName: Tables.orders,
    Key: { plantId, orderDateTicket },
  }));

  return ok(updated.Item);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getValidNext(status) {
  const map = {
    pending:    ['dispatched', 'cancelled'],
    dispatched: ['in_transit', 'cancelled'],
    in_transit: ['pouring', 'cancelled'],
    pouring:    ['returning', 'cancelled'],
    returning:  ['complete'],
    complete:   [],
    cancelled:  [],
  };
  return map[status] ?? [];
}
