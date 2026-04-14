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
  computeTimeline,
  TIMELINE,
} from '/opt/nodejs/dynamo-client.mjs';

// Lazy import to avoid module-load failures when Aurora isn't configured
let _aurora;
async function aurora() {
  if (!_aurora) _aurora = await import('/opt/nodejs/aurora-client.mjs');
  return _aurora;
}


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
    if (method === 'GET'   && path === '/customers/search')   return searchCustomers(event);
    if (method === 'GET'   && path === '/plants')              return listPlants(event);
    if (method === 'GET'   && path === '/mix-designs')         return listMixDesigns(event);
    if (method === 'POST'  && path === '/mix-designs')         return createMixDesign(event);
    if (method === 'GET'   && path === '/customers/{customerId}/job-sites') return listJobSites(event);
    if (method === 'GET'   && path === '/mix-designs/{mixDesignId}')      return getMixDesign(event);
    if (method === 'PATCH' && path === '/mix-designs/{mixDesignId}')      return updateMixDesign(event);
    if (method === 'PATCH' && path === '/mix-designs/{mixDesignId}/status') return toggleMixDesignStatus(event);
    if (method === 'GET'   && path === '/ingredients')         return listIngredients(event);
    if (method === 'GET'   && path === '/admixtures')          return listAdmixtures(event);

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
    jobSiteLatitude:  body.jobSiteLatitude ?? null,
    jobSiteLongitude: body.jobSiteLongitude ?? null,
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
  const exprValues      = { ':updatedAt': now };
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

  // ── Timeline computation on scheduling ───────────────────────────────────
  // When scheduling, work backward from requestedTime so concrete arrives on time:
  //   scheduledDepartureAt = requestedTime - loadingDuration - transitDuration
  if (body.status === 'scheduled' && body.routeData) {
    const transitMs = body.routeData.durationSeconds * 1000;
    const departureMs = new Date(current.requestedTime).getTime() - TIMELINE.loadingDurationMs - transitMs;
    const departureAt = new Date(departureMs).toISOString();
    const timeline = computeTimeline(
      departureAt,
      body.routeData.durationSeconds,
      current.volume,
    );
    setClauses.push('timeline = :timeline');
    exprValues[':timeline'] = timeline;

    setClauses.push('routeData = :routeData');
    exprValues[':routeData'] = {
      coordinates:    body.routeData.coordinates,
      distanceMeters: body.routeData.distanceMeters,
      durationSeconds: body.routeData.durationSeconds,
    };
  }

  // ── Unscheduling (scheduled -> pending) ─────────────────────────────────
  if (body.status === 'pending' && current.status === 'scheduled') {
    setClauses.push('assignedTruckId = :null, assignedTruckNumber = :null, driverName = :null');
    setClauses.push('timeline = :null, routeData = :null');
    exprValues[':null'] = null;
  }

  // ── Cancellation return logic ─────────────────────────────────────────
  if (body.status === 'cancelled') {
    const cancelledAt = now;
    const cancellation = { cancelledAt };

    if (current.status === 'scheduled' || current.status === 'dispatched') {
      // Not yet departed or still loading — no return needed, truck freed immediately
      // (truck update handled below)
    } else if (current.timeline && current.status === 'in_transit') {
      // Mid-transit: compute fraction traveled, proportional return time
      const tl = current.timeline;
      const nowMs = Date.now();
      const transitStartMs = new Date(tl.loadingCompletesAt).getTime();
      const transitEndMs   = new Date(tl.transitArrivalAt).getTime();
      const transitTotal   = transitEndMs - transitStartMs;
      const elapsed        = Math.min(nowMs - transitStartMs, transitTotal);
      const fraction       = transitTotal > 0 ? elapsed / transitTotal : 0;
      const returnTimeMs   = fraction * (current.routeData?.durationSeconds ?? 0) * 1000;
      cancellation.estimatedReturnAt = new Date(nowMs + returnTimeMs).toISOString();
      cancellation.positionAtCancel = [fraction]; // fraction for frontend interpolation
    } else if (current.status === 'pouring') {
      // At job site — full return trip
      const returnTimeMs = (current.routeData?.durationSeconds ?? 0) * 1000;
      cancellation.estimatedReturnAt = new Date(nowMs + returnTimeMs).toISOString();
    }
    // returning status — already heading back, just mark cancelled

    setClauses.push('cancellation = :cancellation');
    exprValues[':cancellation'] = cancellation;
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

  // ── RequestedTime editing (only allowed for pending orders) ──────────
  if (body.requestedTime != null && body.status == null) {
    if (current.status !== 'pending') {
      return conflict('requestedTime can only be changed when order is pending');
    }
    const newDate = new Date(body.requestedTime);
    if (isNaN(newDate.getTime())) {
      return badRequest('requestedTime must be a valid ISO 8601 datetime');
    }
    if (newDate.getTime() < Date.now() - 5 * 60 * 1000) {
      return badRequest('requestedTime cannot be set to the past');
    }
    setClauses.push('requestedTime = :reqTime');
    exprValues[':reqTime'] = body.requestedTime;
  }

  // Optimistic lock: only update if status hasn't changed since we fetched
  let conditionExpression;
  if (body.status != null) {
    conditionExpression = '#st = :currentStatus';
    exprValues[':currentStatus'] = current.status;
    exprNames['#st'] = 'status';
  } else {
    conditionExpression = 'attribute_exists(plantId)';
  }

  await ddb.send(new UpdateCommand({
    TableName: Tables.orders,
    Key: { plantId, orderDateTicket },
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ConditionExpression: conditionExpression,
    ExpressionAttributeValues: exprValues,
    ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
  }));

  // ── Truck status side-effects ────────────────────────────────────────────
  const truckId = body.assignedTruckId ?? current.assignedTruckId;
  if (truckId && body.status != null) {
    try {
      if (body.status === 'scheduled') {
        // Reserve truck for future departure — stays at plant
        const plantResult = await ddb.send(new GetCommand({
          TableName: Tables.plants, Key: { plantId },
        }));
        const plantData = plantResult.Item;
        await ddb.send(new UpdateCommand({
          TableName: Tables.trucks,
          Key: { truckId },
          UpdateExpression: 'SET currentStatus = :st, currentOrderId = :oid, currentJobSite = :js, lastUpdated = :now, latitude = :lat, longitude = :lng',
          ExpressionAttributeValues: {
            ':st': 'scheduled', ':oid': current.ticketNumber,
            ':js': current.jobSiteName, ':now': now,
            ':lat': plantData?.latitude ?? null, ':lng': plantData?.longitude ?? null,
          },
        }));
      } else if (body.status === 'dispatched') {
        // Truck begins loading at plant
        const plantResult = await ddb.send(new GetCommand({
          TableName: Tables.plants, Key: { plantId },
        }));
        const plantData = plantResult.Item;
        await ddb.send(new UpdateCommand({
          TableName: Tables.trucks,
          Key: { truckId },
          UpdateExpression: 'SET currentStatus = :st, currentOrderId = :oid, currentJobSite = :js, lastUpdated = :now, latitude = :lat, longitude = :lng',
          ExpressionAttributeValues: {
            ':st': 'loading', ':oid': current.ticketNumber,
            ':js': current.jobSiteName, ':now': now,
            ':lat': plantData?.latitude ?? null, ':lng': plantData?.longitude ?? null,
          },
        }));
      } else if (body.status === 'pending' && current.status === 'scheduled') {
        // Unscheduling — free truck
        await ddb.send(new UpdateCommand({
          TableName: Tables.trucks, Key: { truckId: current.assignedTruckId },
          UpdateExpression: 'SET currentStatus = :st, currentOrderId = :null, currentJobSite = :null, lastUpdated = :now',
          ExpressionAttributeValues: { ':st': 'available', ':null': null, ':now': now },
        }));
      } else if (body.status === 'cancelled') {
        if (['scheduled', 'dispatched'].includes(current.status)) {
          // Not yet departed or still loading — free truck immediately
          await ddb.send(new UpdateCommand({
            TableName: Tables.trucks, Key: { truckId },
            UpdateExpression: 'SET currentStatus = :st, currentOrderId = :null, currentJobSite = :null, lastUpdated = :now',
            ExpressionAttributeValues: { ':st': 'available', ':null': null, ':now': now },
          }));
        } else if (['in_transit', 'pouring'].includes(current.status)) {
          // Truck needs to return — set to returning
          await ddb.send(new UpdateCommand({
            TableName: Tables.trucks, Key: { truckId },
            UpdateExpression: 'SET currentStatus = :st, lastUpdated = :now',
            ExpressionAttributeValues: { ':st': 'returning', ':now': now },
          }));
        }
      }
    } catch (truckErr) {
      console.error('Failed to update truck status:', truckErr);
      // Non-fatal: order update succeeded, truck will be corrected by ticker
    }
  }

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
    pending:    ['scheduled', 'cancelled'],
    scheduled:  ['dispatched', 'pending', 'cancelled'],
    dispatched: ['in_transit', 'cancelled'],
    in_transit: ['pouring', 'cancelled'],
    pouring:    ['returning', 'cancelled'],
    returning:  ['complete'],
    complete:   [],
    cancelled:  [],
  };
  return map[status] ?? [];
}

// ─── GET /customers/search ───────────────────────────────────────────────
//
// Debounced typeahead for the New Order form.
// Queries Aurora customers table with ILIKE fuzzy matching.

async function searchCustomers(event) {
  const { q } = getQueryParams(event);

  const { query: q_, param: p_ } = await aurora();

  // If no search term, return all active customers (for initial dropdown)
  if (!q || q.length < 1) {
    const { rows } = await q_(
      `SELECT id, name, account_number AS "accountNumber", city, state
       FROM customers WHERE is_active = true ORDER BY name LIMIT 20`
    );
    return ok({ customers: rows });
  }

  const { rows } = await q_(
    `SELECT
       id,
       name,
       account_number AS "accountNumber",
       city,
       state
     FROM customers
     WHERE is_active = true
       AND name ILIKE '%' || :term || '%'
     ORDER BY name
     LIMIT 10`,
    [p_('term', q)]
  );

  return ok({ customers: rows });
}

// ─── GET /plants ─────────────────────────────────────────────────────────

async function listPlants() {
  const { query: q_, } = await aurora();
  const { rows } = await q_(
    `SELECT
       code AS "plantId",
       name,
       address,
       city,
       state,
       phone,
       lat AS "latitude",
       lng AS "longitude"
     FROM plants
     WHERE is_active = true
     ORDER BY name`
  );

  return ok({ plants: rows });
}

// ─── GET /mix-designs ────────────────────────────────────────────────────

async function listMixDesigns(event) {
  const { plantId, psiMin, psiMax, pourType, includeInactive } = getQueryParams(event);
  const { query: q_, param: p_ } = await aurora();

  let sql = `
    SELECT
      md.id           AS "mixDesignId",
      md.name,
      md.code,
      md.psi_rating   AS "psi",
      md.slump_min    AS "slumpMin",
      md.slump_max    AS "slumpMax",
      md.description,
      md.yield_per_batch AS "yieldPerBatch",
      md.cost_per_yard   AS "costPerYard",
      md.is_active       AS "isActive"
    FROM mix_designs md`;

  const params = [];
  const conditions = [];

  if (plantId) {
    sql += `
    JOIN plant_mix_designs pmd ON pmd.mix_design_id = md.id`;
    conditions.push(`pmd.plant_id = (SELECT id FROM plants WHERE code = :plantId)`);
    params.push(p_('plantId', plantId));
  }

  if (pourType) {
    sql += `
    JOIN mix_design_applications mda_filter ON mda_filter.mix_design_id = md.id`;
    conditions.push(`mda_filter.pour_type = :pourType::pour_type`);
    params.push(p_('pourType', pourType));
  }

  if (includeInactive !== 'true') {
    conditions.push(`md.is_active = true`);
  }

  if (psiMin) {
    conditions.push(`md.psi_rating >= :psiMin`);
    params.push(p_('psiMin', Number(psiMin)));
  }
  if (psiMax) {
    conditions.push(`md.psi_rating <= :psiMax`);
    params.push(p_('psiMax', Number(psiMax)));
  }

  if (conditions.length > 0) {
    sql += `\n    WHERE ` + conditions.join(`\n      AND `);
  }

  sql += `
    ORDER BY md.psi_rating, md.name`;

  const { rows } = await q_(sql, params);

  // Fetch applications for all returned mix designs
  if (rows.length > 0) {
    const ids = rows.map(r => r.mixDesignId);
    const { rows: appRows } = await q_(
      `SELECT mix_design_id AS "mixDesignId", pour_type AS "pourType"
       FROM mix_design_applications
       WHERE mix_design_id = ANY(ARRAY[${ids.map((_, i) => `:appId${i}::UUID`).join(',')}])`,
      ids.map((id, i) => p_(`appId${i}`, id))
    );
    const appMap = {};
    for (const r of appRows) {
      if (!appMap[r.mixDesignId]) appMap[r.mixDesignId] = [];
      appMap[r.mixDesignId].push(r.pourType);
    }
    for (const row of rows) {
      row.applications = appMap[row.mixDesignId] || [];
    }
  }

  return ok({ mixDesigns: rows, count: rows.length });
}

// ─── GET /customers/{customerId}/job-sites ───────────────────────────────

async function listJobSites(event) {
  const { customerId } = getPathParams(event);
  if (!customerId) return badRequest('customerId path param is required');

  const { query: q_, param: p_ } = await aurora();
  const { rows } = await q_(
    `SELECT
       id        AS "siteId",
       name,
       address,
       city,
       state,
       lat       AS "latitude",
       lng       AS "longitude"
     FROM customer_job_sites
     WHERE customer_id = :customerId::UUID
       AND is_active = true
     ORDER BY name`,
    [p_('customerId', customerId)]
  );

  return ok({ jobSites: rows });
}

// ─── GET /mix-designs/{mixDesignId} ──────────────────────────────────────

async function getMixDesign(event) {
  const { mixDesignId } = getPathParams(event);
  if (!mixDesignId) return badRequest('mixDesignId path param is required');

  const { query: q_, param: p_ } = await aurora();

  // Get mix design + ingredients + admixtures + applications in parallel
  const [designResult, ingredientsResult, admixturesResult, applicationsResult] = await Promise.all([
    q_(
      `SELECT id AS "mixDesignId", code, name, psi_rating AS "psi",
              slump_min AS "slumpMin", slump_max AS "slumpMax",
              description, yield_per_batch AS "yieldPerBatch",
              cost_per_yard AS "costPerYard", is_active AS "isActive"
       FROM mix_designs WHERE code = :mixDesignId`,
      [p_('mixDesignId', mixDesignId)]
    ),
    q_(
      `SELECT i.id AS "ingredientId", i.name, mdi.quantity, mdi.unit
       FROM mix_design_ingredients mdi
       JOIN ingredients i ON mdi.ingredient_id = i.id
       JOIN mix_designs md ON mdi.mix_design_id = md.id
       WHERE md.code = :mixDesignId
       ORDER BY mdi.quantity DESC`,
      [p_('mixDesignId', mixDesignId)]
    ),
    q_(
      `SELECT a.id AS "admixtureId", a.name, a.type, mda.dosage, mda.unit
       FROM mix_design_admixtures mda
       JOIN admixtures a ON mda.admixture_id = a.id
       JOIN mix_designs md ON mda.mix_design_id = md.id
       WHERE md.code = :mixDesignId`,
      [p_('mixDesignId', mixDesignId)]
    ),
    q_(
      `SELECT mda.pour_type AS "pourType"
       FROM mix_design_applications mda
       JOIN mix_designs md ON mda.mix_design_id = md.id
       WHERE md.code = :mixDesignId`,
      [p_('mixDesignId', mixDesignId)]
    ),
  ]);

  if (designResult.rows.length === 0) return notFound(`Mix design ${mixDesignId} not found`);

  return ok({
    ...designResult.rows[0],
    ingredients: ingredientsResult.rows,
    admixtures: admixturesResult.rows,
    applications: applicationsResult.rows.map(r => r.pourType),
  });
}

// ─── POST /mix-designs ──────────────────────────────────────────────────

async function createMixDesign(event) {
  const body = parseBody(event);
  const { query: q_, param: p_, transaction: tx_ } = await aurora();

  const required = ['code', 'name', 'psi', 'slumpMin', 'slumpMax'];
  const missing = required.filter(f => body[f] == null || body[f] === '');
  if (missing.length > 0) return badRequest(`Missing: ${missing.join(', ')}`);

  if (body.psi <= 0) return badRequest('psi must be > 0');
  if (body.slumpMin >= body.slumpMax) return badRequest('slumpMin must be less than slumpMax');
  if (!body.ingredients || body.ingredients.length === 0) return badRequest('At least one ingredient is required');

  // Check for duplicate code
  const existing = await q_(`SELECT id FROM mix_designs WHERE code = :code`, [p_('code', body.code)]);
  if (existing.rows.length > 0) return conflict(`Mix design code "${body.code}" already exists`);

  const statements = [];

  // 1. Insert mix design
  statements.push({
    sql: `INSERT INTO mix_designs (code, name, psi_rating, slump_min, slump_max, description, yield_per_batch, cost_per_yard)
          VALUES (:code, :name, :psi, :slumpMin, :slumpMax, :description, :yieldPerBatch, :costPerYard)
          RETURNING id`,
    parameters: [
      p_('code', body.code),
      p_('name', body.name),
      p_('psi', Number(body.psi)),
      p_('slumpMin', Number(body.slumpMin)),
      p_('slumpMax', Number(body.slumpMax)),
      p_('description', body.description || null),
      p_('yieldPerBatch', body.yieldPerBatch ? Number(body.yieldPerBatch) : null),
      p_('costPerYard', body.costPerYard ? Number(body.costPerYard) : null),
    ],
  });

  const results = await tx_(statements);
  const mixDesignId = results[0].rows[0].id;

  // 2. Insert ingredients, admixtures, applications, and plant link in a second transaction
  const childStatements = [];

  for (const ing of body.ingredients) {
    childStatements.push({
      sql: `INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit)
            VALUES (:mixId::UUID, :ingId::UUID, :qty, :unit)`,
      parameters: [
        p_('mixId', mixDesignId),
        p_('ingId', ing.ingredientId),
        p_('qty', Number(ing.quantity)),
        p_('unit', ing.unit),
      ],
    });
  }

  if (body.admixtures) {
    for (const adm of body.admixtures) {
      childStatements.push({
        sql: `INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit)
              VALUES (:mixId::UUID, :admId::UUID, :dosage, :unit)`,
        parameters: [
          p_('mixId', mixDesignId),
          p_('admId', adm.admixtureId),
          p_('dosage', Number(adm.dosage)),
          p_('unit', adm.unit || 'oz'),
        ],
      });
    }
  }

  if (body.applications) {
    for (const pourType of body.applications) {
      childStatements.push({
        sql: `INSERT INTO mix_design_applications (mix_design_id, pour_type)
              VALUES (:mixId::UUID, :pourType::pour_type)`,
        parameters: [
          p_('mixId', mixDesignId),
          p_('pourType', pourType),
        ],
      });
    }
  }

  if (body.plantId) {
    childStatements.push({
      sql: `INSERT INTO plant_mix_designs (plant_id, mix_design_id)
            VALUES ((SELECT id FROM plants WHERE code = :plantId), :mixId::UUID)`,
      parameters: [
        p_('plantId', body.plantId),
        p_('mixId', mixDesignId),
      ],
    });
  }

  if (childStatements.length > 0) {
    await tx_(childStatements);
  }

  return created({
    mixDesignId,
    code: body.code,
    name: body.name,
    psi: Number(body.psi),
  });
}

// ─── PATCH /mix-designs/{mixDesignId} ───────────────────────────────────

async function updateMixDesign(event) {
  const { mixDesignId } = getPathParams(event);
  if (!mixDesignId) return badRequest('mixDesignId path param is required');

  const body = parseBody(event);
  const { query: q_, param: p_, transaction: tx_ } = await aurora();

  // Resolve the internal UUID from the code
  const { rows } = await q_(`SELECT id FROM mix_designs WHERE code = :code`, [p_('code', mixDesignId)]);
  if (rows.length === 0) return notFound(`Mix design ${mixDesignId} not found`);
  const id = rows[0].id;

  const statements = [];

  // Build SET clause dynamically for provided fields
  const updates = [];
  const params = [p_('id', id)];
  if (body.name !== undefined) { updates.push('name = :name'); params.push(p_('name', body.name)); }
  if (body.psi !== undefined) { updates.push('psi_rating = :psi'); params.push(p_('psi', Number(body.psi))); }
  if (body.slumpMin !== undefined) { updates.push('slump_min = :slumpMin'); params.push(p_('slumpMin', Number(body.slumpMin))); }
  if (body.slumpMax !== undefined) { updates.push('slump_max = :slumpMax'); params.push(p_('slumpMax', Number(body.slumpMax))); }
  if (body.description !== undefined) { updates.push('description = :description'); params.push(p_('description', body.description)); }
  if (body.yieldPerBatch !== undefined) { updates.push('yield_per_batch = :yieldPerBatch'); params.push(p_('yieldPerBatch', Number(body.yieldPerBatch))); }
  if (body.costPerYard !== undefined) { updates.push('cost_per_yard = :costPerYard'); params.push(p_('costPerYard', Number(body.costPerYard))); }

  if (updates.length > 0) {
    updates.push('updated_at = NOW()');
    statements.push({
      sql: `UPDATE mix_designs SET ${updates.join(', ')} WHERE id = :id::UUID`,
      parameters: params,
    });
  }

  // Replace ingredients if provided
  if (body.ingredients) {
    statements.push({
      sql: `DELETE FROM mix_design_ingredients WHERE mix_design_id = :id::UUID`,
      parameters: [p_('id', id)],
    });
    for (const ing of body.ingredients) {
      statements.push({
        sql: `INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit)
              VALUES (:mixId::UUID, :ingId::UUID, :qty, :unit)`,
        parameters: [
          p_('mixId', id),
          p_('ingId', ing.ingredientId),
          p_('qty', Number(ing.quantity)),
          p_('unit', ing.unit),
        ],
      });
    }
  }

  // Replace admixtures if provided
  if (body.admixtures) {
    statements.push({
      sql: `DELETE FROM mix_design_admixtures WHERE mix_design_id = :id::UUID`,
      parameters: [p_('id', id)],
    });
    for (const adm of body.admixtures) {
      statements.push({
        sql: `INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit)
              VALUES (:mixId::UUID, :admId::UUID, :dosage, :unit)`,
        parameters: [
          p_('mixId', id),
          p_('admId', adm.admixtureId),
          p_('dosage', Number(adm.dosage)),
          p_('unit', adm.unit || 'oz'),
        ],
      });
    }
  }

  // Replace applications if provided
  if (body.applications) {
    statements.push({
      sql: `DELETE FROM mix_design_applications WHERE mix_design_id = :id::UUID`,
      parameters: [p_('id', id)],
    });
    for (const pourType of body.applications) {
      statements.push({
        sql: `INSERT INTO mix_design_applications (mix_design_id, pour_type)
              VALUES (:mixId::UUID, :pourType::pour_type)`,
        parameters: [
          p_('mixId', id),
          p_('pourType', pourType),
        ],
      });
    }
  }

  if (statements.length === 0) return badRequest('No fields to update');

  await tx_(statements);
  return ok({ updated: true, mixDesignId });
}

// ─── PATCH /mix-designs/{mixDesignId}/status ────────────────────────────

async function toggleMixDesignStatus(event) {
  const { mixDesignId } = getPathParams(event);
  if (!mixDesignId) return badRequest('mixDesignId path param is required');

  const body = parseBody(event);
  if (body.isActive === undefined) return badRequest('isActive is required');

  const { query: q_, param: p_ } = await aurora();
  const { rowCount } = await q_(
    `UPDATE mix_designs SET is_active = :isActive, updated_at = NOW() WHERE code = :code`,
    [p_('isActive', body.isActive), p_('code', mixDesignId)]
  );

  if (rowCount === 0) return notFound(`Mix design ${mixDesignId} not found`);
  return ok({ updated: true, isActive: body.isActive });
}

// ─── GET /ingredients ───────────────────────────────────────────────────

async function listIngredients(event) {
  const { query: q_ } = await aurora();
  const { rows } = await q_(
    `SELECT id AS "ingredientId", name, category, unit, cost_per_unit AS "costPerUnit"
     FROM ingredients WHERE is_active = true ORDER BY category, name`
  );
  return ok({ ingredients: rows });
}

// ─── GET /admixtures ────────────────────────────────────────────────────

async function listAdmixtures(event) {
  const { query: q_ } = await aurora();
  const { rows } = await q_(
    `SELECT id AS "admixtureId", name, type, unit, cost_per_unit AS "costPerUnit"
     FROM admixtures WHERE is_active = true ORDER BY type, name`
  );
  return ok({ admixtures: rows });
}
