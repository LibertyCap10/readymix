/**
 * seed-dynamodb.mjs — Seed all three DynamoDB tables with realistic sample data.
 *
 * Data seeded:
 *   Plants table  — 2 plants (Riverside + Northside)
 *   Trucks table  — 8 trucks (5 at Plant-001, 3 at Plant-002) with current statuses
 *   Orders table  — active orders across both plants for today's date
 *
 * The seed creates a "living" snapshot: orders have timeline fields with
 * timestamps relative to NOW so the ticker Lambda immediately starts advancing
 * deliveries through their lifecycle.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/seed-dynamodb.mjs
 *
 * To clear and reseed:
 *   ENVIRONMENT=dev node scripts/seed-dynamodb.mjs --clear
 */

import {
  DynamoDBClient,
  BatchWriteItemCommand,
  DeleteItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

// ─── Configuration ────────────────────────────────────────────────────────

const ENV    = process.env.ENVIRONMENT ?? 'dev';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const TABLES = {
  orders: `readymix-orders-${ENV}`,
  trucks: `readymix-trucks-${ENV}`,
  plants: `readymix-plants-${ENV}`,
};

const client = new DynamoDBClient({ region: REGION });

const CLEAR_MODE = process.argv.includes('--clear');
const _now       = new Date();
const TODAY      = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
const NOW_MS     = Date.now();

// ─── Timeline constants (match backend/layers/shared/nodejs/dynamo-client.mjs) ──
const LOADING_MS      = 7 * 60 * 1000;       // 7 min
const POUR_RATE_MS    = 10 * 60 * 1000;      // 10 min/yd
const MIN_POUR_MS     = 5 * 60 * 1000;       // 5 min floor

function computeTimeline(departureMs, transitDurationSec, volumeYards) {
  const loadingComplete = departureMs + LOADING_MS;
  const transitMs       = transitDurationSec * 1000;
  const pourMs          = Math.max(MIN_POUR_MS, volumeYards * POUR_RATE_MS);
  const arrival         = loadingComplete + transitMs;
  const pourComplete    = arrival + pourMs;
  const returnArrival   = pourComplete + transitMs;

  return {
    scheduledDepartureAt: new Date(departureMs).toISOString(),
    loadingCompletesAt:   new Date(loadingComplete).toISOString(),
    transitArrivalAt:     new Date(arrival).toISOString(),
    pourCompletesAt:      new Date(pourComplete).toISOString(),
    returnDepartureAt:    new Date(pourComplete).toISOString(),
    returnArrivalAt:      new Date(returnArrival).toISOString(),
  };
}

function min(ms) { return ms * 60 * 1000; }

/**
 * Derive the correct order status from where NOW falls within the timeline.
 * Used so the seed data is always consistent regardless of when the script runs.
 */
function computeStatusFromTimeline(tl, nowMs) {
  if (nowMs < new Date(tl.scheduledDepartureAt).getTime()) return 'scheduled';
  if (nowMs < new Date(tl.loadingCompletesAt).getTime())   return 'dispatched';
  if (nowMs < new Date(tl.transitArrivalAt).getTime())     return 'in_transit';
  if (nowMs < new Date(tl.pourCompletesAt).getTime())      return 'pouring';
  if (nowMs < new Date(tl.returnArrivalAt).getTime())      return 'returning';
  return 'complete';
}

// ─── Plants ───────────────────────────────────────────────────────────────

const PLANTS = [
  {
    plantId:   'PLANT-001',
    name:      'Riverside Batch Plant',
    address:   '1200 Industrial Blvd',
    city:      'Austin',
    state:     'TX',
    phone:     '(512) 555-0100',
    latitude:  30.2672,
    longitude: -97.7431,
  },
  {
    plantId:   'PLANT-002',
    name:      'Northside Ready-Mix',
    address:   '4500 Quarry Rd',
    city:      'Round Rock',
    state:     'TX',
    phone:     '(512) 555-0200',
    latitude:  30.5083,
    longitude: -97.6789,
  },
];

// ─── Pre-cached Mapbox route data ────────────────────────────────────────
// Simplified route coordinates for known plant→jobsite pairs (Austin area).
// This avoids Mapbox API calls during seeding.

const ROUTES = {
  // PLANT-001 (30.2672, -97.7431) → various job sites
  'PLANT-001→30.3100,-97.7500': {
    coordinates: [[-97.7431,30.2672],[-97.7445,30.2750],[-97.7460,30.2830],[-97.7475,30.2910],[-97.7490,30.2990],[-97.7500,30.3100]],
    distanceMeters: 5200, durationSeconds: 720, // ~12 min
  },
  'PLANT-001→30.4020,-97.7250': {
    coordinates: [[-97.7431,30.2672],[-97.7400,30.2800],[-97.7350,30.3000],[-97.7300,30.3300],[-97.7270,30.3600],[-97.7250,30.4020]],
    distanceMeters: 16500, durationSeconds: 1320, // ~22 min
  },
  'PLANT-001→30.2980,-97.7050': {
    coordinates: [[-97.7431,30.2672],[-97.7350,30.2720],[-97.7250,30.2780],[-97.7150,30.2850],[-97.7050,30.2980]],
    distanceMeters: 5800, durationSeconds: 660, // ~11 min
  },
  'PLANT-001→30.2450,-97.7750': {
    coordinates: [[-97.7431,30.2672],[-97.7500,30.2620],[-97.7580,30.2560],[-97.7680,30.2500],[-97.7750,30.2450]],
    distanceMeters: 4200, durationSeconds: 540, // ~9 min
  },
  'PLANT-001→30.3520,-97.6900': {
    coordinates: [[-97.7431,30.2672],[-97.7350,30.2800],[-97.7200,30.3000],[-97.7050,30.3200],[-97.6900,30.3520]],
    distanceMeters: 11500, durationSeconds: 960, // ~16 min
  },
  'PLANT-001→30.2500,-97.7490': {
    coordinates: [[-97.7431,30.2672],[-97.7445,30.2620],[-97.7460,30.2570],[-97.7490,30.2500]],
    distanceMeters: 2100, durationSeconds: 360, // ~6 min
  },
  'PLANT-001→30.2300,-97.6200': {
    coordinates: [[-97.7431,30.2672],[-97.7200,30.2600],[-97.6900,30.2500],[-97.6600,30.2400],[-97.6200,30.2300]],
    distanceMeters: 13200, durationSeconds: 1140, // ~19 min
  },
  // PLANT-002 (30.5083, -97.6789) → various job sites
  'PLANT-002→30.5250,-97.6600': {
    coordinates: [[-97.6789,30.5083],[-97.6750,30.5120],[-97.6700,30.5170],[-97.6650,30.5210],[-97.6600,30.5250]],
    distanceMeters: 2800, durationSeconds: 420, // ~7 min
  },
  'PLANT-002→30.4530,-97.6200': {
    coordinates: [[-97.6789,30.5083],[-97.6700,30.4950],[-97.6550,30.4800],[-97.6400,30.4650],[-97.6200,30.4530]],
    distanceMeters: 9200, durationSeconds: 780, // ~13 min
  },
  'PLANT-002→30.5150,-97.8200': {
    coordinates: [[-97.6789,30.5083],[-97.7000,30.5100],[-97.7300,30.5120],[-97.7600,30.5140],[-97.7900,30.5150],[-97.8200,30.5150]],
    distanceMeters: 14500, durationSeconds: 1080, // ~18 min
  },
};

function getRoute(plantId, lat, lng) {
  const plant = plantId === 'PLANT-001' ? PLANTS[0] : PLANTS[1];
  const key = `${plantId}→${lat},${lng}`;
  if (ROUTES[key]) return ROUTES[key];
  // Fallback: generate a simple straight-line route
  return {
    coordinates: [[plant.longitude, plant.latitude], [lng, lat]],
    distanceMeters: 8000,
    durationSeconds: 900, // 15 min default
  };
}

// ─── Truck definitions ───────────────────────────────────────────────────

const TRUCK_DEFS = [
  { truckId: 'TRUCK-101', truckNumber: '101', plantId: 'PLANT-001', type: 'rear_discharge', capacity: 10, year: 2022, make: 'Kenworth', model: 'T880', vin: '1NKWL70X42J123456', driverName: 'Jesse Ramirez', driverId: 'DRV-001' },
  { truckId: 'TRUCK-102', truckNumber: '102', plantId: 'PLANT-001', type: 'rear_discharge', capacity: 10, year: 2021, make: 'Peterbilt', model: '567', vin: '2XPWD49X71M789012', driverName: 'Maria Santos', driverId: 'DRV-002' },
  { truckId: 'TRUCK-103', truckNumber: '103', plantId: 'PLANT-001', type: 'front_discharge', capacity: 11, year: 2023, make: 'Mack', model: 'Granite', vin: '1M2AX07C63M345678', driverName: 'Darnell Washington', driverId: 'DRV-003' },
  { truckId: 'TRUCK-104', truckNumber: '104', plantId: 'PLANT-001', type: 'rear_discharge', capacity: 10, year: 2020, make: 'Kenworth', model: 'T880', vin: '1NKWL70X40J901234', driverName: 'Travis Nguyen', driverId: 'DRV-004' },
  { truckId: 'TRUCK-105', truckNumber: '105', plantId: 'PLANT-001', type: 'volumetric', capacity: 8, year: 2023, make: 'Cemen Tech', model: 'C60', vin: '5CT6000123A567890', driverName: 'Kim Patel', driverId: 'DRV-005' },
  { truckId: 'TRUCK-201', truckNumber: '201', plantId: 'PLANT-002', type: 'rear_discharge', capacity: 10, year: 2022, make: 'Peterbilt', model: '567', vin: '2XPWD49X72M234567', driverName: 'Bobby Fischer', driverId: 'DRV-006' },
  { truckId: 'TRUCK-202', truckNumber: '202', plantId: 'PLANT-002', type: 'rear_discharge', capacity: 10, year: 2021, make: 'Kenworth', model: 'T880', vin: '1NKWL70X41J678901', driverName: 'Angela Brooks', driverId: 'DRV-007' },
  { truckId: 'TRUCK-203', truckNumber: '203', plantId: 'PLANT-002', type: 'front_discharge', capacity: 11, year: 2024, make: 'Mack', model: 'Granite', vin: '1M2AX07C64M012345', driverName: 'Luis Ortega', driverId: 'DRV-008' },
];

// ─── Build living orders ─────────────────────────────────────────────────
// Each order is placed at a specific point in its lifecycle relative to NOW.
// Status is DERIVED from the timeline using computeStatusFromTimeline() —
// not hardcoded — so the seed is always consistent.
// The ticker will pick them up and advance them through remaining phases.

function makeOrders() {
  const orders = [];

  // ── PLANT-001 orders ─────────────────────────────────────────────────

  // Order 1: IN TRANSIT (departed 15 min ago, ~12 min route = ~67% through transit)
  const o1Route = getRoute('PLANT-001', 30.3100, -97.7500);
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0001',
    customerId: 'CUST-001', customerName: 'Hill Country Builders',
    jobSiteId: 'SITE-001', jobSiteName: 'Lakewood Estates Phase 2',
    jobSiteAddress: '800 Lakewood Dr, Austin, TX',
    jobSiteLatitude: 30.3100, jobSiteLongitude: -97.7500,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 9, slump: 5, pourType: 'foundation',
    isHotLoad: false,
    notes: 'Pump truck on site. Use north entrance.',
    assignedTruckId: 'TRUCK-101', assignedTruckNumber: '101', driverName: 'Jesse Ramirez',
    departureMs: NOW_MS - min(15), route: o1Route,
  }));

  // Order 2: POURING (departed 34 min ago, arrived ~29 min ago, mid-pour)
  const o2Route = getRoute('PLANT-001', 30.4020, -97.7250);
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0002',
    customerId: 'CUST-002', customerName: 'Lone Star Commercial',
    jobSiteId: 'SITE-002', jobSiteName: 'Domain Tower III',
    jobSiteAddress: '11500 Domain Dr, Austin, TX',
    jobSiteLatitude: 30.4020, jobSiteLongitude: -97.7250,
    mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
    psi: 5000, volume: 10, slump: 4, pourType: 'column',
    isHotLoad: false,
    assignedTruckId: 'TRUCK-102', assignedTruckNumber: '102', driverName: 'Maria Santos',
    departureMs: NOW_MS - min(34), route: o2Route,
  }));

  // Order 3: RETURNING (departed long ago, pour finished ~5 min ago)
  const o3Route = getRoute('PLANT-001', 30.2980, -97.7050);
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0003',
    customerId: 'CUST-003', customerName: 'Mueller Development Group',
    jobSiteId: 'SITE-003', jobSiteName: 'Mueller Mixed-Use Development',
    jobSiteAddress: '4715 Airport Blvd, Austin, TX',
    jobSiteLatitude: 30.2980, jobSiteLongitude: -97.7050,
    mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
    psi: 3000, volume: 7, slump: 6, pourType: 'slab',
    isHotLoad: false,
    assignedTruckId: 'TRUCK-104', assignedTruckNumber: '104', driverName: 'Travis Nguyen',
    departureMs: NOW_MS - min(93), route: o3Route,
  }));

  // Order 4: PENDING — no truck, requested 30 min from now
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0004',
    customerId: 'CUST-001', customerName: 'Hill Country Builders',
    jobSiteId: 'SITE-004', jobSiteName: 'Barton Hills Residence',
    jobSiteAddress: '2100 Barton Hills Dr, Austin, TX',
    jobSiteLatitude: 30.2450, jobSiteLongitude: -97.7750,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 4, slump: 5, pourType: 'driveway',
    status: 'pending', isHotLoad: false,
  }));

  // Order 5: PENDING hot load — no truck, requested 20 min from now
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0005',
    customerId: 'CUST-004', customerName: 'Capital City Infrastructure',
    jobSiteId: 'SITE-005', jobSiteName: 'I-35 Expansion Project',
    jobSiteAddress: 'US-183 & I-35, Austin, TX',
    jobSiteLatitude: 30.3520, jobSiteLongitude: -97.6900,
    mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
    psi: 5000, volume: 12, slump: 4, pourType: 'footing',
    status: 'pending', isHotLoad: true,
    notes: 'HOT LOAD -- TxDOT window. Needs truck ASAP.',
  }));

  // Order 6: IN TRANSIT — departed 10 min ago, past 7-min loading, en route (~6 min route)
  const o6Route = getRoute('PLANT-001', 30.2500, -97.7490);
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0006',
    customerId: 'CUST-002', customerName: 'Lone Star Commercial',
    jobSiteId: 'SITE-006', jobSiteName: 'South Congress Hotel',
    jobSiteAddress: '1603 S Congress Ave, Austin, TX',
    jobSiteLatitude: 30.2500, jobSiteLongitude: -97.7490,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 8, slump: 5, pourType: 'wall',
    isHotLoad: false,
    assignedTruckId: 'TRUCK-103', assignedTruckNumber: '103', driverName: 'Darnell Washington',
    departureMs: NOW_MS - min(10), route: o6Route,
  }));

  // Order 7: PENDING — scheduled for tomorrow
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0007',
    customerId: 'CUST-005', customerName: 'Travis County Roads',
    jobSiteId: 'SITE-007', jobSiteName: 'FM 969 Bridge Repair',
    jobSiteAddress: 'FM 969 & Colorado River, TX',
    jobSiteLatitude: 30.2300, jobSiteLongitude: -97.6200,
    mixDesignId: '3500PSI-AIR', mixDesignName: '3500 PSI Air-Entrained',
    psi: 3500, volume: 6, slump: 5, pourType: 'grade_beam',
    status: 'pending', isHotLoad: false,
  }));

  // Order 8: CANCELLED (was never dispatched)
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0008',
    customerId: 'CUST-003', customerName: 'Mueller Development Group',
    jobSiteId: 'SITE-003', jobSiteName: 'Mueller Mixed-Use Development',
    jobSiteAddress: '4715 Airport Blvd, Austin, TX',
    jobSiteLatitude: 30.2980, jobSiteLongitude: -97.7050,
    mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
    psi: 3000, volume: 5, slump: 6, pourType: 'slab',
    status: 'cancelled', isHotLoad: false,
    notes: 'Customer cancelled -- rain delay',
  }));

  // Order 9: SCHEDULED — truck assigned, departure in 15 min
  // requestedTime is far enough in the future that departureAt = requestedTime - loading - transit is ~15 min from now
  const o9Route = getRoute('PLANT-001', 30.2450, -97.7750);
  orders.push(makeOrder({
    plantId: 'PLANT-001', ticketNumber: 'TKT-2026-0009',
    customerId: 'CUST-001', customerName: 'Hill Country Builders',
    jobSiteId: 'SITE-004', jobSiteName: 'Barton Hills Residence',
    jobSiteAddress: '2100 Barton Hills Dr, Austin, TX',
    jobSiteLatitude: 30.2450, jobSiteLongitude: -97.7750,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 6, slump: 5, pourType: 'foundation',
    isHotLoad: false,
    notes: 'Backyard access only, use side gate.',
    assignedTruckId: 'TRUCK-105', assignedTruckNumber: '105', driverName: 'Kim Patel',
    // Departure 15 min from now → scheduled status (truck hasn't departed yet)
    departureMs: NOW_MS + min(15), route: o9Route,
  }));

  // ── PLANT-002 orders ─────────────────────────────────────────────────

  // Order 10: COMPLETE (departed 60 min ago, short route)
  const o10Route = getRoute('PLANT-002', 30.5250, -97.6600);
  orders.push(makeOrder({
    plantId: 'PLANT-002', ticketNumber: 'TKT-2026-0010',
    customerId: 'CUST-006', customerName: 'Round Rock Commercial',
    jobSiteId: 'SITE-010', jobSiteName: 'Kalahari Resort Expansion',
    jobSiteAddress: '3001 Kalahari Blvd, Round Rock, TX',
    jobSiteLatitude: 30.5250, jobSiteLongitude: -97.6600,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 3, slump: 5, pourType: 'foundation',
    isHotLoad: false,
    assignedTruckId: 'TRUCK-203', assignedTruckNumber: '203', driverName: 'Luis Ortega',
    departureMs: NOW_MS - min(60), route: o10Route,
  }));

  // Order 15: IN TRANSIT (departed 8 min ago, 13 min route → ~12 min of visible transit)
  const o15Route = getRoute('PLANT-002', 30.4530, -97.6200);
  orders.push(makeOrder({
    plantId: 'PLANT-002', ticketNumber: 'TKT-2026-0015',
    customerId: 'CUST-007', customerName: 'Pflugerville Independent SD',
    jobSiteId: 'SITE-015', jobSiteName: 'Pflugerville Town Center',
    jobSiteAddress: '100 Town Center Dr, Pflugerville, TX',
    jobSiteLatitude: 30.4530, jobSiteLongitude: -97.6200,
    mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
    psi: 3000, volume: 8, slump: 6, pourType: 'sidewalk',
    isHotLoad: false,
    assignedTruckId: 'TRUCK-202', assignedTruckNumber: '202', driverName: 'Angela Brooks',
    departureMs: NOW_MS - min(8), route: o15Route,
  }));

  // Order 16: PENDING — no truck
  orders.push(makeOrder({
    plantId: 'PLANT-002', ticketNumber: 'TKT-2026-0016',
    customerId: 'CUST-008', customerName: 'Cedar Park Residential',
    jobSiteId: 'SITE-016', jobSiteName: 'Whitestone Estates',
    jobSiteAddress: '300 Whitestone Blvd, Cedar Park, TX',
    jobSiteLatitude: 30.5150, jobSiteLongitude: -97.8200,
    mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
    psi: 4000, volume: 6, slump: 5, pourType: 'driveway',
    status: 'pending', isHotLoad: false,
  }));

  // Order 17: IN TRANSIT — departed 9 min ago, past loading, en route (~7 min route), hot load
  const o17Route = getRoute('PLANT-002', 30.5250, -97.6600);
  orders.push(makeOrder({
    plantId: 'PLANT-002', ticketNumber: 'TKT-2026-0017',
    customerId: 'CUST-006', customerName: 'Round Rock Commercial',
    jobSiteId: 'SITE-017', jobSiteName: 'Kalahari Resort Expansion',
    jobSiteAddress: '3001 Kalahari Blvd, Round Rock, TX',
    jobSiteLatitude: 30.5250, jobSiteLongitude: -97.6600,
    mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
    psi: 5000, volume: 11, slump: 4, pourType: 'column',
    isHotLoad: true,
    notes: 'HOT LOAD -- crane scheduled soon',
    assignedTruckId: 'TRUCK-201', assignedTruckNumber: '201', driverName: 'Bobby Fischer',
    departureMs: NOW_MS - min(9), route: o17Route,
  }));

  return orders;
}

// ─── Order builder ───────────────────────────────────────────────────────

function makeOrder(o) {
  const now = new Date().toISOString();
  const dateStr = TODAY;
  const requestedTime = o.requestedTime ?? `${dateStr}T${new Date(NOW_MS + min(30)).toISOString().slice(11, 19)}Z`;

  // Build event history based on status and timeline
  const events = [];
  const statusOrder = ['pending', 'scheduled', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled'];

  if (o.departureMs && o.route) {
    const tl = computeTimeline(o.departureMs, o.route.durationSeconds, o.volume);

    // Derive status from timeline position (unless explicitly set, e.g. 'cancelled')
    const derivedStatus = o.status ?? computeStatusFromTimeline(tl, NOW_MS);
    const targetIdx = statusOrder.indexOf(derivedStatus);

    events.push({ timestamp: new Date(o.departureMs - min(30)).toISOString(), eventType: 'pending', note: 'Order created' });
    if (targetIdx >= 1 && derivedStatus !== 'cancelled') {
      events.push({ timestamp: new Date(o.departureMs - min(15)).toISOString(), eventType: 'scheduled', note: `Assigned to Truck ${o.assignedTruckNumber}` });
    }
    if (targetIdx >= 2 && derivedStatus !== 'cancelled') {
      events.push({ timestamp: tl.scheduledDepartureAt, eventType: 'dispatched', note: 'Auto-advanced by ticker' });
    }
    if (targetIdx >= 3) events.push({ timestamp: tl.loadingCompletesAt, eventType: 'in_transit', note: 'Auto-advanced by ticker' });
    if (targetIdx >= 4) events.push({ timestamp: tl.transitArrivalAt, eventType: 'pouring', note: 'Auto-advanced by ticker' });
    if (targetIdx >= 5) events.push({ timestamp: tl.returnDepartureAt, eventType: 'returning', note: 'Auto-advanced by ticker' });
    if (targetIdx >= 6) events.push({ timestamp: tl.returnArrivalAt, eventType: 'complete', note: 'Auto-advanced by ticker' });
    if (derivedStatus === 'cancelled') events.push({ timestamp: now, eventType: 'cancelled', note: o.notes ?? 'Cancelled' });

    const order = {
      plantId: o.plantId,
      orderDateTicket: `${dateStr}#${o.ticketNumber}`,
      ticketNumber: o.ticketNumber,
      customerId: o.customerId, customerName: o.customerName,
      jobSiteId: o.jobSiteId, jobSiteName: o.jobSiteName,
      jobSiteAddress: o.jobSiteAddress,
      jobSiteLatitude: o.jobSiteLatitude, jobSiteLongitude: o.jobSiteLongitude,
      mixDesignId: o.mixDesignId, mixDesignName: o.mixDesignName,
      psi: o.psi, volume: o.volume, slump: o.slump, pourType: o.pourType,
      requestedTime,
      status: derivedStatus,
      isHotLoad: o.isHotLoad ?? false,
      notes: o.notes ?? null,
      events,
      createdAt: events[0]?.timestamp ?? now,
      updatedAt: events.at(-1)?.timestamp ?? now,
      // Timeline + route data
      timeline: tl,
      routeData: {
        coordinates: o.route.coordinates,
        distanceMeters: o.route.distanceMeters,
        durationSeconds: o.route.durationSeconds,
      },
    };

    if (o.assignedTruckId) {
      order.assignedTruckId = o.assignedTruckId;
      order.assignedTruckNumber = o.assignedTruckNumber;
      order.driverName = o.driverName;
    }

    return order;
  }

  // Pending/cancelled orders without timeline
  events.push({ timestamp: new Date(NOW_MS - min(30)).toISOString(), eventType: 'pending', note: 'Order created' });
  if (o.status === 'cancelled') {
    events.push({ timestamp: now, eventType: 'cancelled', note: o.notes ?? 'Cancelled' });
  }

  return {
    plantId: o.plantId,
    orderDateTicket: `${dateStr}#${o.ticketNumber}`,
    ticketNumber: o.ticketNumber,
    customerId: o.customerId, customerName: o.customerName,
    jobSiteId: o.jobSiteId, jobSiteName: o.jobSiteName,
    jobSiteAddress: o.jobSiteAddress,
    jobSiteLatitude: o.jobSiteLatitude, jobSiteLongitude: o.jobSiteLongitude,
    mixDesignId: o.mixDesignId, mixDesignName: o.mixDesignName,
    psi: o.psi, volume: o.volume, slump: o.slump, pourType: o.pourType,
    requestedTime,
    status: o.status,
    isHotLoad: o.isHotLoad ?? false,
    notes: o.notes ?? null,
    events,
    createdAt: events[0]?.timestamp ?? now,
    updatedAt: events.at(-1)?.timestamp ?? now,
  };
}

// ─── Build truck items with status matching their assigned orders ─────────

function makeTrucks(orders) {
  return TRUCK_DEFS.map(def => {
    const assignedOrder = orders.find(o => o.assignedTruckId === def.truckId && !['complete', 'cancelled', 'pending'].includes(o.status));
    const plant = PLANTS.find(p => p.plantId === def.plantId);

    // Count all today's orders for this truck that progressed past scheduled (including complete)
    const loadsToday = orders.filter(o =>
      o.assignedTruckId === def.truckId &&
      !['pending', 'scheduled', 'cancelled'].includes(o.status)
    ).length;

    // Find last completed order for lastWashout timestamp
    const completedOrders = orders.filter(o =>
      o.assignedTruckId === def.truckId && o.status === 'complete' && o.timeline
    );
    const lastCompleted = completedOrders.length > 0
      ? completedOrders.reduce((latest, o) =>
          new Date(o.timeline.returnArrivalAt) > new Date(latest.timeline.returnArrivalAt) ? o : latest
        )
      : null;
    const lastWashout = lastCompleted
      ? lastCompleted.timeline.returnArrivalAt
      : new Date(NOW_MS - 20 * 60 * 60 * 1000).toISOString(); // yesterday ~4pm fallback

    const truck = { ...def, lastUpdated: new Date().toISOString(), loadsToday, lastWashout };

    if (assignedOrder) {
      // Map order status to truck status
      const statusMap = { scheduled: 'scheduled', dispatched: 'loading', in_transit: 'in_transit', pouring: 'pouring', returning: 'returning' };
      truck.currentStatus = statusMap[assignedOrder.status] ?? 'available';
      truck.currentOrderId = assignedOrder.ticketNumber;
      truck.currentJobSite = assignedOrder.jobSiteName;

      // Set truck position based on current phase
      // Trucks can ONLY be at: the plant, on the defined route, or at the job site
      if (assignedOrder.status === 'scheduled' || assignedOrder.status === 'dispatched') {
        // Scheduled or loading — truck is at plant
        truck.latitude = plant.latitude;
        truck.longitude = plant.longitude;
      } else if (assignedOrder.status === 'pouring') {
        // At job site
        truck.latitude = assignedOrder.jobSiteLatitude;
        truck.longitude = assignedOrder.jobSiteLongitude;
      } else if (assignedOrder.status === 'in_transit' && assignedOrder.timeline && assignedOrder.routeData) {
        // Interpolate position along forward route (plant → job site)
        const startMs = new Date(assignedOrder.timeline.loadingCompletesAt).getTime();
        const endMs = new Date(assignedOrder.timeline.transitArrivalAt).getTime();
        const fraction = Math.min(Math.max((NOW_MS - startMs) / (endMs - startMs), 0), 1);
        const coords = assignedOrder.routeData.coordinates;
        const idx = Math.min(Math.floor(fraction * (coords.length - 1)), coords.length - 2);
        const segFrac = (fraction * (coords.length - 1)) - idx;
        truck.latitude = coords[idx][1] + segFrac * (coords[idx + 1][1] - coords[idx][1]);
        truck.longitude = coords[idx][0] + segFrac * (coords[idx + 1][0] - coords[idx][0]);
      } else if (assignedOrder.status === 'returning' && assignedOrder.timeline && assignedOrder.routeData) {
        // Interpolate position along reversed route (job site → plant)
        const startMs = new Date(assignedOrder.timeline.returnDepartureAt).getTime();
        const endMs = new Date(assignedOrder.timeline.returnArrivalAt).getTime();
        const fraction = Math.min(Math.max((NOW_MS - startMs) / (endMs - startMs), 0), 1);
        const coords = assignedOrder.routeData.coordinates;
        // Reverse the route: fraction 0 = job site (end of coords), fraction 1 = plant (start of coords)
        const revFraction = 1 - fraction;
        const idx = Math.min(Math.floor(revFraction * (coords.length - 1)), coords.length - 2);
        const segFrac = (revFraction * (coords.length - 1)) - idx;
        truck.latitude = coords[idx][1] + segFrac * (coords[idx + 1][1] - coords[idx][1]);
        truck.longitude = coords[idx][0] + segFrac * (coords[idx + 1][0] - coords[idx][0]);
      } else {
        // Fallback: truck at plant (should not normally reach here)
        truck.latitude = plant.latitude;
        truck.longitude = plant.longitude;
      }
    } else {
      truck.currentStatus = def.truckId === 'TRUCK-105' ? 'maintenance' : 'available';
      truck.latitude = plant.latitude;
      truck.longitude = plant.longitude;
    }

    return truck;
  });
}

// ─── Generate orders for a date range (historical) ───────────────────────

function makeOrdersForRange(startDate, endDate) {
  const CUSTOMERS = [
    { id: 'CUST-001', name: 'Hill Country Builders', siteId: 'SITE-001', siteName: 'Lakewood Estates Phase 2', siteAddr: '800 Lakewood Dr, Austin, TX', lat: 30.3100, lng: -97.7500 },
    { id: 'CUST-002', name: 'Lone Star Commercial', siteId: 'SITE-002', siteName: 'Domain Tower III', siteAddr: '11500 Domain Dr, Austin, TX', lat: 30.4020, lng: -97.7250 },
    { id: 'CUST-003', name: 'Mueller Development Group', siteId: 'SITE-003', siteName: 'Mueller Mixed-Use Development', siteAddr: '4715 Airport Blvd, Austin, TX', lat: 30.2980, lng: -97.7050 },
    { id: 'CUST-004', name: 'Capital City Infrastructure', siteId: 'SITE-005', siteName: 'I-35 Expansion Project', siteAddr: 'US-183 & I-35, Austin, TX', lat: 30.3520, lng: -97.6900 },
    { id: 'CUST-005', name: 'Travis County Roads', siteId: 'SITE-007', siteName: 'FM 969 Bridge Repair', siteAddr: 'FM 969 & Colorado River, TX', lat: 30.2300, lng: -97.6200 },
    { id: 'CUST-006', name: 'Round Rock Commercial', siteId: 'SITE-010', siteName: 'Kalahari Resort Expansion', siteAddr: '3001 Kalahari Blvd, Round Rock, TX', lat: 30.5250, lng: -97.6600 },
    { id: 'CUST-007', name: 'Pflugerville Independent SD', siteId: 'SITE-015', siteName: 'Pflugerville Town Center', siteAddr: '100 Town Center Dr, Pflugerville, TX', lat: 30.4530, lng: -97.6200 },
  ];
  const MIXES = [
    { id: '3000PSI-STD', name: '3000 PSI Standard', psi: 3000 },
    { id: '4000PSI-STD', name: '4000 PSI Standard', psi: 4000 },
    { id: '5000PSI-HE',  name: '5000 PSI High-Early', psi: 5000 },
    { id: '3500PSI-AIR', name: '3500 PSI Air-Entrained', psi: 3500 },
  ];
  const POUR_TYPES = ['foundation', 'slab', 'wall', 'driveway', 'sidewalk', 'column', 'footing', 'grade_beam'];
  const TRUCKS_P1 = [
    { id: 'TRUCK-101', num: '101', driver: 'Jesse Ramirez' },
    { id: 'TRUCK-102', num: '102', driver: 'Maria Santos' },
    { id: 'TRUCK-103', num: '103', driver: 'Darnell Washington' },
    { id: 'TRUCK-104', num: '104', driver: 'Travis Nguyen' },
  ];
  const TRUCKS_P2 = [
    { id: 'TRUCK-201', num: '201', driver: 'Bobby Fischer' },
    { id: 'TRUCK-202', num: '202', driver: 'Angela Brooks' },
    { id: 'TRUCK-203', num: '203', driver: 'Luis Ortega' },
  ];

  const allOrders = [];
  let ticketCounter = 5000;
  const start = new Date(startDate + 'T00:00:00Z');
  const end   = new Date(endDate + 'T00:00:00Z');

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    // Today is handled by makeOrders() with live timeline-based statuses
    if (dateStr === TODAY) continue;

    const isPast    = dateStr < TODAY;
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const ordersPerDay = isWeekend ? 4 : 8;

    for (let i = 0; i < ordersPerDay; i++) {
      const cust = CUSTOMERS[i % CUSTOMERS.length];
      const mix  = MIXES[i % MIXES.length];
      const isPlant2 = i >= 5;
      const plantId = isPlant2 ? 'PLANT-002' : 'PLANT-001';
      const trucks = isPlant2 ? TRUCKS_P2 : TRUCKS_P1;
      const truck = trucks[i % trucks.length];
      const volume = [4, 6, 8, 9, 10, 12][i % 6];
      const slump = [4, 5, 5, 6][i % 4];
      const pourType = POUR_TYPES[i % POUR_TYPES.length];
      const isHotLoad = i % 7 === 0;
      const hour = 7 + i;
      const ticketNumber = `TKT-2026-${String(ticketCounter++).padStart(4, '0')}`;

      // Deterministic jitter so timestamps aren't all on the exact hour
      const jitterMs = ((ticketCounter * 7) % 20 - 10) * 60 * 1000;

      const requestedTimeMs = Date.parse(`${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`);
      const requestedTime = new Date(requestedTimeMs).toISOString();

      if (isPast) {
        // ── PAST: all orders are complete with full timeline ──
        const route = getRoute(plantId, cust.lat, cust.lng);
        const departureMs = requestedTimeMs - (route.durationSeconds * 1000) - LOADING_MS + jitterMs;
        const tl = computeTimeline(departureMs, route.durationSeconds, volume);

        const events = [
          { timestamp: new Date(departureMs - min(30)).toISOString(), eventType: 'pending', note: 'Order created' },
          { timestamp: new Date(departureMs - min(15)).toISOString(), eventType: 'scheduled', note: `Assigned to Truck ${truck.num}` },
          { timestamp: tl.scheduledDepartureAt, eventType: 'dispatched', note: 'Auto-advanced by ticker' },
          { timestamp: tl.loadingCompletesAt, eventType: 'in_transit', note: 'Auto-advanced by ticker' },
          { timestamp: tl.transitArrivalAt, eventType: 'pouring', note: 'Auto-advanced by ticker' },
          { timestamp: tl.returnDepartureAt, eventType: 'returning', note: 'Auto-advanced by ticker' },
          { timestamp: tl.returnArrivalAt, eventType: 'complete', note: 'Auto-advanced by ticker' },
        ];

        allOrders.push({
          plantId, ticketNumber,
          orderDateTicket: `${dateStr}#${ticketNumber}`,
          customerId: cust.id, customerName: cust.name,
          jobSiteId: cust.siteId, jobSiteName: cust.siteName, jobSiteAddress: cust.siteAddr,
          jobSiteLatitude: cust.lat, jobSiteLongitude: cust.lng,
          mixDesignId: mix.id, mixDesignName: mix.name, psi: mix.psi,
          volume, slump, pourType, requestedTime,
          status: 'complete',
          isHotLoad, events,
          assignedTruckId: truck.id,
          assignedTruckNumber: truck.num,
          driverName: truck.driver,
          timeline: tl,
          routeData: {
            coordinates: route.coordinates,
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
          },
          createdAt: events[0].timestamp,
          updatedAt: events.at(-1).timestamp,
        });
      } else {
        // ── FUTURE: only pending or scheduled ──
        const isScheduled = i % 5 >= 3; // ~40% scheduled, ~60% pending
        const status = isScheduled ? 'scheduled' : 'pending';

        const events = [
          { timestamp: new Date(requestedTimeMs - min(60)).toISOString(), eventType: 'pending', note: 'Order created' },
        ];
        if (isScheduled) {
          events.push({ timestamp: new Date(requestedTimeMs - min(30)).toISOString(), eventType: 'scheduled', note: `Assigned to Truck ${truck.num}` });
        }

        const order = {
          plantId, ticketNumber,
          orderDateTicket: `${dateStr}#${ticketNumber}`,
          customerId: cust.id, customerName: cust.name,
          jobSiteId: cust.siteId, jobSiteName: cust.siteName, jobSiteAddress: cust.siteAddr,
          jobSiteLatitude: cust.lat, jobSiteLongitude: cust.lng,
          mixDesignId: mix.id, mixDesignName: mix.name, psi: mix.psi,
          volume, slump, pourType, requestedTime,
          status, isHotLoad, events,
          createdAt: events[0].timestamp,
          updatedAt: events.at(-1).timestamp,
        };

        if (isScheduled) {
          order.assignedTruckId = truck.id;
          order.assignedTruckNumber = truck.num;
          order.driverName = truck.driver;
        }

        allOrders.push(order);
      }
    }
  }

  return allOrders;
}

// ─── Batch write helper ───────────────────────────────────────────────────

async function batchWrite(tableName, items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const requestItems = {
      [tableName]: chunk.map((item) => ({
        PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) },
      })),
    };

    const command  = new BatchWriteItemCommand({ RequestItems: requestItems });
    const response = await client.send(command);

    const unprocessed = response.UnprocessedItems?.[tableName];
    if (unprocessed?.length > 0) {
      console.warn(`  ${unprocessed.length} unprocessed items in ${tableName} -- retrying`);
      await new Promise((r) => setTimeout(r, 1000));
      await client.send(new BatchWriteItemCommand({
        RequestItems: { [tableName]: unprocessed },
      }));
    }
  }
}

// ─── Clear tables ─────────────────────────────────────────────────────────

async function clearTable(tableName, keyNames) {
  console.log(`  Clearing ${tableName}...`);
  const scan = await client.send(new ScanCommand({ TableName: tableName }));
  const items = scan.Items ?? [];

  for (const item of items) {
    const key = {};
    for (const k of keyNames) { key[k] = item[k]; }
    await client.send(new DeleteItemCommand({ TableName: tableName, Key: key }));
  }
  console.log(`   Deleted ${items.length} items from ${tableName}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n  ReadyMix DynamoDB Seed Script (Timeline-Aware)`);
  console.log(`   Environment: ${ENV}`);
  console.log(`   Region:      ${REGION}`);
  console.log(`   Date:        ${TODAY}`);
  console.log(`   Now:         ${new Date(NOW_MS).toISOString()}`);
  console.log('');

  if (CLEAR_MODE) {
    await clearTable(TABLES.orders, ['plantId', 'orderDateTicket']);
    await clearTable(TABLES.trucks, ['truckId']);
    await clearTable(TABLES.plants, ['plantId']);
    console.log('');
  }

  // Seed Plants
  console.log(`  Seeding ${PLANTS.length} plants`);
  await batchWrite(TABLES.plants, PLANTS);

  // Build today's orders with timelines relative to NOW
  const todayOrders = makeOrders();
  console.log(`  Seeding ${todayOrders.length} timeline-aware orders for today`);
  await batchWrite(TABLES.orders, todayOrders);

  // Build trucks with statuses matching their assigned orders
  const trucks = makeTrucks(todayOrders);
  console.log(`  Seeding ${trucks.length} trucks (statuses match active orders)`);
  await batchWrite(TABLES.trucks, trucks);

  // Seed historical + future orders for date range (today is skipped — handled by makeOrders)
  const rangeOrders = makeOrdersForRange('2026-04-08', '2026-04-24');
  console.log(`  Seeding ${rangeOrders.length} historical/future orders (Apr 8-24, today excluded)`);
  await batchWrite(TABLES.orders, rangeOrders);

  console.log('\n  Seed complete!\n');

  // Show living status summary
  const statusCounts = {};
  for (const o of todayOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }
  console.log('  Today\'s orders by status:');
  for (const [s, c] of Object.entries(statusCounts)) {
    console.log(`    ${s}: ${c}`);
  }

  const activeTrucks = trucks.filter(t => !['available', 'maintenance'].includes(t.currentStatus));
  console.log(`\n  Active trucks: ${activeTrucks.length}`);
  for (const t of activeTrucks) {
    console.log(`    ${t.truckId} (${t.truckNumber}): ${t.currentStatus} -> ${t.currentJobSite ?? 'plant'}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n  Seed failed:', err.message);
  process.exit(1);
});
