/**
 * seed-dynamodb.mjs — Seed all three DynamoDB tables with realistic sample data.
 *
 * Data seeded:
 *   Plants table  — 2 plants (Riverside + Northside)
 *   Trucks table  — 8 trucks (5 at Plant-001, 3 at Plant-002) with current statuses
 *   Orders table  — 20 active orders across both plants for today's date
 *
 * The data mirrors the frontend mocks so the Phase 6 API integration is seamless:
 * plant IDs, truck IDs, customer IDs, and ticket numbers are identical.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/seed-dynamodb.mjs
 *
 * Prerequisites:
 *   aws configure (with credentials that have DynamoDB write access)
 *   Tables must already exist (sam build && sam deploy first)
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
const TODAY      = new Date().toISOString().slice(0, 10);  // "YYYY-MM-DD"

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

// ─── Trucks ───────────────────────────────────────────────────────────────

const TRUCKS = [
  {
    truckId:        'TRUCK-101',
    truckNumber:    '101',
    plantId:        'PLANT-001',
    type:           'rear_discharge',
    capacity:       10,
    year:           2022,
    make:           'Kenworth',
    model:          'T880',
    vin:            '1NKWL70X42J123456',
    driverName:     'Jesse Ramirez',
    driverId:       'DRV-001',
    currentStatus:  'in_transit',
    currentOrderId: 'TKT-2026-0001',
    currentJobSite: 'Lakewood Estates Phase 2',
    lastUpdated:    `${TODAY}T06:45:00Z`,
    loadsToday:     2,
    latitude:       30.2900,
    longitude:      -97.7450,
  },
  {
    truckId:        'TRUCK-102',
    truckNumber:    '102',
    plantId:        'PLANT-001',
    type:           'rear_discharge',
    capacity:       10,
    year:           2021,
    make:           'Peterbilt',
    model:          '567',
    vin:            '2XPWD49X71M789012',
    driverName:     'Maria Santos',
    driverId:       'DRV-002',
    currentStatus:  'pouring',
    currentOrderId: 'TKT-2026-0005',
    currentJobSite: 'Domain Tower III',
    lastUpdated:    `${TODAY}T07:15:00Z`,
    loadsToday:     3,
    latitude:       30.4020,
    longitude:      -97.7250,
  },
  {
    truckId:       'TRUCK-103',
    truckNumber:   '103',
    plantId:       'PLANT-001',
    type:          'front_discharge',
    capacity:      11,
    year:          2023,
    make:          'Mack',
    model:         'Granite',
    vin:           '1M2AX07C63M345678',
    driverName:    'Darnell Washington',
    driverId:      'DRV-003',
    currentStatus: 'available',
    lastUpdated:   `${TODAY}T07:00:00Z`,
    loadsToday:    1,
  },
  {
    truckId:        'TRUCK-104',
    truckNumber:    '104',
    plantId:        'PLANT-001',
    type:           'rear_discharge',
    capacity:       10,
    year:           2020,
    make:           'Kenworth',
    model:          'T880',
    vin:            '1NKWL70X40J901234',
    driverName:     'Travis Nguyen',
    driverId:       'DRV-004',
    currentStatus:  'returning',
    currentOrderId: 'TKT-2026-0003',
    currentJobSite: 'Mueller Mixed-Use Development',
    lastUpdated:    `${TODAY}T07:30:00Z`,
    loadsToday:     4,
    latitude:       30.2850,
    longitude:      -97.7200,
  },
  {
    truckId:       'TRUCK-105',
    truckNumber:   '105',
    plantId:       'PLANT-001',
    type:          'volumetric',
    capacity:      8,
    year:          2023,
    make:          'Cemen Tech',
    model:         'C60',
    vin:           '5CT6000123A567890',
    driverName:    'Kim Patel',
    driverId:      'DRV-005',
    currentStatus: 'maintenance',
    lastUpdated:   `${TODAY}T06:00:00Z`,
    loadsToday:    0,
  },
  {
    truckId:       'TRUCK-201',
    truckNumber:   '201',
    plantId:       'PLANT-002',
    type:          'rear_discharge',
    capacity:      10,
    year:          2022,
    make:          'Peterbilt',
    model:         '567',
    vin:           '2XPWD49X72M234567',
    driverName:    'Bobby Fischer',
    driverId:      'DRV-006',
    currentStatus: 'loading',
    lastUpdated:   `${TODAY}T06:50:00Z`,
    loadsToday:    2,
  },
  {
    truckId:        'TRUCK-202',
    truckNumber:    '202',
    plantId:        'PLANT-002',
    type:           'rear_discharge',
    capacity:       10,
    year:           2021,
    make:           'Kenworth',
    model:          'T880',
    vin:            '1NKWL70X41J678901',
    driverName:     'Angela Brooks',
    driverId:       'DRV-007',
    currentStatus:  'in_transit',
    currentOrderId: 'TKT-2026-0015',
    currentJobSite: 'Pflugerville Town Center',
    lastUpdated:    `${TODAY}T07:10:00Z`,
    loadsToday:     3,
    latitude:       30.4500,
    longitude:      -97.6350,
  },
  {
    truckId:       'TRUCK-203',
    truckNumber:   '203',
    plantId:       'PLANT-002',
    type:          'front_discharge',
    capacity:      11,
    year:          2024,
    make:          'Mack',
    model:         'Granite',
    vin:           '1M2AX07C64M012345',
    driverName:    'Luis Ortega',
    driverId:      'DRV-008',
    currentStatus: 'available',
    lastUpdated:   `${TODAY}T07:15:00Z`,
    loadsToday:    1,
  },
];

// ─── Orders ───────────────────────────────────────────────────────────────
// 20 orders matching the frontend mock data.
// SK format: "YYYY-MM-DD#TKT-XXXXXX"

function makeOrders() {
  const orders = [
    // ── PLANT-001 orders ──────────────────────────────────────────────────
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0001',
      customerId: 'CUST-001', customerName: 'Hill Country Builders',
      jobSiteId: 'SITE-001', jobSiteName: 'Lakewood Estates Phase 2',
      jobSiteAddress: '800 Lakewood Dr, Austin, TX',
      jobSiteLatitude: 30.3100, jobSiteLongitude: -97.7500,
      mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
      psi: 4000, volume: 9, slump: 5, pourType: 'foundation',
      requestedTime: `${TODAY}T07:00:00Z`,
      assignedTruckId: 'TRUCK-101', assignedTruckNumber: '101',
      driverName: 'Jesse Ramirez',
      status: 'in_transit', isHotLoad: false,
      notes: 'Pump truck on site. Use north entrance.',
      events: [
        { timestamp: `${TODAY}T05:30:00Z`, eventType: 'pending', note: 'Order placed' },
        { timestamp: `${TODAY}T06:00:00Z`, eventType: 'dispatched', note: 'Assigned to Truck 101' },
        { timestamp: `${TODAY}T06:45:00Z`, eventType: 'in_transit' },
      ],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0002',
      customerId: 'CUST-002', customerName: 'Lone Star Commercial',
      jobSiteId: 'SITE-002', jobSiteName: 'Domain Tower III',
      jobSiteAddress: '11500 Domain Dr, Austin, TX',
      jobSiteLatitude: 30.4020, jobSiteLongitude: -97.7250,
      mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
      psi: 5000, volume: 10, slump: 4, pourType: 'column',
      requestedTime: `${TODAY}T07:30:00Z`,
      assignedTruckId: 'TRUCK-102', assignedTruckNumber: '102',
      driverName: 'Maria Santos',
      status: 'pouring', isHotLoad: false,
      events: [
        { timestamp: `${TODAY}T05:00:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T05:45:00Z`, eventType: 'dispatched' },
        { timestamp: `${TODAY}T06:30:00Z`, eventType: 'in_transit' },
        { timestamp: `${TODAY}T07:15:00Z`, eventType: 'pouring', note: 'Began pour at column C-4' },
      ],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0003',
      customerId: 'CUST-003', customerName: 'Mueller Development Group',
      jobSiteId: 'SITE-003', jobSiteName: 'Mueller Mixed-Use Development',
      jobSiteAddress: '4715 Airport Blvd, Austin, TX',
      jobSiteLatitude: 30.2980, jobSiteLongitude: -97.7050,
      mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
      psi: 3000, volume: 7, slump: 6, pourType: 'slab',
      requestedTime: `${TODAY}T08:00:00Z`,
      assignedTruckId: 'TRUCK-104', assignedTruckNumber: '104',
      driverName: 'Travis Nguyen',
      status: 'returning', isHotLoad: false,
      events: [
        { timestamp: `${TODAY}T06:00:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T06:30:00Z`, eventType: 'dispatched' },
        { timestamp: `${TODAY}T07:00:00Z`, eventType: 'in_transit' },
        { timestamp: `${TODAY}T07:45:00Z`, eventType: 'pouring' },
        { timestamp: `${TODAY}T08:15:00Z`, eventType: 'returning' },
      ],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0004',
      customerId: 'CUST-001', customerName: 'Hill Country Builders',
      jobSiteId: 'SITE-004', jobSiteName: 'Barton Hills Residence',
      jobSiteAddress: '2100 Barton Hills Dr, Austin, TX',
      jobSiteLatitude: 30.2450, jobSiteLongitude: -97.7750,
      mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
      psi: 4000, volume: 4, slump: 5, pourType: 'driveway',
      requestedTime: `${TODAY}T09:00:00Z`,
      status: 'pending', isHotLoad: false,
      events: [{ timestamp: `${TODAY}T08:00:00Z`, eventType: 'pending' }],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0005',
      customerId: 'CUST-004', customerName: 'Capital City Infrastructure',
      jobSiteId: 'SITE-005', jobSiteName: 'I-35 Expansion Project',
      jobSiteAddress: 'US-183 & I-35, Austin, TX',
      jobSiteLatitude: 30.3520, jobSiteLongitude: -97.6900,
      mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
      psi: 5000, volume: 12, slump: 4, pourType: 'footing',
      requestedTime: `${TODAY}T09:30:00Z`,
      status: 'pending', isHotLoad: true,
      notes: 'HOT LOAD — TxDOT window 09:30-11:00 only',
      events: [{ timestamp: `${TODAY}T08:30:00Z`, eventType: 'pending', note: 'Hot load flagged' }],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0006',
      customerId: 'CUST-002', customerName: 'Lone Star Commercial',
      jobSiteId: 'SITE-006', jobSiteName: 'South Congress Hotel',
      jobSiteAddress: '1603 S Congress Ave, Austin, TX',
      jobSiteLatitude: 30.2500, jobSiteLongitude: -97.7490,
      mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
      psi: 4000, volume: 8, slump: 5, pourType: 'wall',
      requestedTime: `${TODAY}T10:00:00Z`,
      status: 'dispatched', isHotLoad: false,
      assignedTruckId: 'TRUCK-103', assignedTruckNumber: '103',
      driverName: 'Darnell Washington',
      events: [
        { timestamp: `${TODAY}T08:00:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T09:30:00Z`, eventType: 'dispatched', note: 'Truck 103 assigned' },
      ],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0007',
      customerId: 'CUST-005', customerName: 'Travis County Roads',
      jobSiteId: 'SITE-007', jobSiteName: 'FM 969 Bridge Repair',
      jobSiteAddress: 'FM 969 & Colorado River, TX',
      jobSiteLatitude: 30.2300, jobSiteLongitude: -97.6200,
      mixDesignId: '3500PSI-AIR', mixDesignName: '3500 PSI Air-Entrained',
      psi: 3500, volume: 6, slump: 5, pourType: 'grade_beam',
      requestedTime: `${TODAY}T10:30:00Z`,
      status: 'pending', isHotLoad: false,
      events: [{ timestamp: `${TODAY}T09:00:00Z`, eventType: 'pending' }],
    },
    {
      plantId: 'PLANT-001',
      ticketNumber: 'TKT-2026-0008',
      customerId: 'CUST-003', customerName: 'Mueller Development Group',
      jobSiteId: 'SITE-003', jobSiteName: 'Mueller Mixed-Use Development',
      jobSiteAddress: '4715 Airport Blvd, Austin, TX',
      jobSiteLatitude: 30.2980, jobSiteLongitude: -97.7050,
      mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
      psi: 3000, volume: 5, slump: 6, pourType: 'slab',
      requestedTime: `${TODAY}T11:00:00Z`,
      status: 'cancelled', isHotLoad: false,
      notes: 'Customer cancelled — rain delay',
      events: [
        { timestamp: `${TODAY}T07:30:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T08:45:00Z`, eventType: 'cancelled', note: 'Rain delay, customer request' },
      ],
    },

    // ── PLANT-002 orders ──────────────────────────────────────────────────
    {
      plantId: 'PLANT-002',
      ticketNumber: 'TKT-2026-0010',
      customerId: 'CUST-006', customerName: 'Round Rock Commercial',
      jobSiteId: 'SITE-010', jobSiteName: 'Kalahari Resort Expansion',
      jobSiteAddress: '3001 Kalahari Blvd, Round Rock, TX',
      jobSiteLatitude: 30.5250, jobSiteLongitude: -97.6600,
      mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
      psi: 4000, volume: 10, slump: 5, pourType: 'foundation',
      requestedTime: `${TODAY}T07:00:00Z`,
      status: 'complete', isHotLoad: false,
      assignedTruckId: 'TRUCK-203', assignedTruckNumber: '203',
      driverName: 'Luis Ortega',
      events: [
        { timestamp: `${TODAY}T05:00:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T05:30:00Z`, eventType: 'dispatched' },
        { timestamp: `${TODAY}T06:00:00Z`, eventType: 'in_transit' },
        { timestamp: `${TODAY}T06:45:00Z`, eventType: 'pouring' },
        { timestamp: `${TODAY}T07:30:00Z`, eventType: 'returning' },
        { timestamp: `${TODAY}T08:00:00Z`, eventType: 'complete' },
      ],
    },
    {
      plantId: 'PLANT-002',
      ticketNumber: 'TKT-2026-0015',
      customerId: 'CUST-007', customerName: 'Pflugerville Independent SD',
      jobSiteId: 'SITE-015', jobSiteName: 'Pflugerville Town Center',
      jobSiteAddress: '100 Town Center Dr, Pflugerville, TX',
      jobSiteLatitude: 30.4530, jobSiteLongitude: -97.6200,
      mixDesignId: '3000PSI-STD', mixDesignName: '3000 PSI Standard',
      psi: 3000, volume: 8, slump: 6, pourType: 'sidewalk',
      requestedTime: `${TODAY}T08:00:00Z`,
      assignedTruckId: 'TRUCK-202', assignedTruckNumber: '202',
      driverName: 'Angela Brooks',
      status: 'in_transit', isHotLoad: false,
      events: [
        { timestamp: `${TODAY}T06:30:00Z`, eventType: 'pending' },
        { timestamp: `${TODAY}T07:00:00Z`, eventType: 'dispatched' },
        { timestamp: `${TODAY}T07:30:00Z`, eventType: 'in_transit' },
      ],
    },
    {
      plantId: 'PLANT-002',
      ticketNumber: 'TKT-2026-0016',
      customerId: 'CUST-008', customerName: 'Cedar Park Residential',
      jobSiteId: 'SITE-016', jobSiteName: 'Whitestone Estates',
      jobSiteAddress: '300 Whitestone Blvd, Cedar Park, TX',
      jobSiteLatitude: 30.5150, jobSiteLongitude: -97.8200,
      mixDesignId: '4000PSI-STD', mixDesignName: '4000 PSI Standard',
      psi: 4000, volume: 6, slump: 5, pourType: 'driveway',
      requestedTime: `${TODAY}T09:00:00Z`,
      status: 'pending', isHotLoad: false,
      events: [{ timestamp: `${TODAY}T07:30:00Z`, eventType: 'pending' }],
    },
    {
      plantId: 'PLANT-002',
      ticketNumber: 'TKT-2026-0017',
      customerId: 'CUST-006', customerName: 'Round Rock Commercial',
      jobSiteId: 'SITE-017', jobSiteName: 'Kalahari Resort Expansion',
      jobSiteAddress: '3001 Kalahari Blvd, Round Rock, TX',
      jobSiteLatitude: 30.5250, jobSiteLongitude: -97.6600,
      mixDesignId: '5000PSI-HE', mixDesignName: '5000 PSI High-Early',
      psi: 5000, volume: 11, slump: 4, pourType: 'column',
      requestedTime: `${TODAY}T10:00:00Z`,
      status: 'dispatched', isHotLoad: true,
      assignedTruckId: 'TRUCK-201', assignedTruckNumber: '201',
      driverName: 'Bobby Fischer',
      notes: 'HOT LOAD — crane scheduled at 10:15',
      events: [
        { timestamp: `${TODAY}T08:00:00Z`, eventType: 'pending', note: 'Hot load' },
        { timestamp: `${TODAY}T09:30:00Z`, eventType: 'dispatched' },
      ],
    },
  ];

  // Add orderDateTicket SK and audit fields to each order
  const now = new Date().toISOString();
  return orders.map((o) => {
    const dateStr = o.requestedTime.slice(0, 10);
    return {
      ...o,
      orderDateTicket: `${dateStr}#${o.ticketNumber}`,
      createdAt: o.events[0]?.timestamp ?? now,
      updatedAt: o.events.at(-1)?.timestamp ?? now,
    };
  });
}

// ─── Generate orders for a date range ────────────────────────────────────
// Creates varied orders for each day from startDate to endDate (inclusive).
// Reuses the order templates but with different dates and unique ticket numbers.

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
    { id: '4000PSI-FBR', name: '4000 PSI Fiber-Reinforced', psi: 4000 },
    { id: '4500PSI-SLG', name: '4500 PSI Slag Blend', psi: 4500 },
    { id: '4000PSI-PMP', name: '4000 PSI Pumpable', psi: 4000 },
    { id: '3000PSI-EC',  name: '3000 PSI Economy', psi: 3000 },
  ];

  const POUR_TYPES = ['foundation', 'slab', 'wall', 'driveway', 'sidewalk', 'column', 'footing', 'grade_beam'];
  const STATUSES = ['pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete'];
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
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const ordersPerDay = isWeekend ? 4 : 8; // fewer on weekends

    for (let i = 0; i < ordersPerDay; i++) {
      const cust = CUSTOMERS[i % CUSTOMERS.length];
      const mix  = MIXES[i % MIXES.length];
      const isPlant2 = i >= 5;
      const plant = isPlant2 ? 'PLANT-002' : 'PLANT-001';
      const trucks = isPlant2 ? TRUCKS_P2 : TRUCKS_P1;
      const truck = trucks[i % trucks.length];
      const volume = [4, 6, 8, 9, 10, 12][i % 6];
      const slump = [4, 5, 5, 6][i % 4];
      const pourType = POUR_TYPES[i % POUR_TYPES.length];
      const isHotLoad = i % 7 === 0;
      const hour = 7 + i;
      const status = STATUSES[i % STATUSES.length];
      const ticketNumber = `TKT-2026-${String(ticketCounter++).padStart(4, '0')}`;

      // Build events up to the current status
      const events = [{ timestamp: `${dateStr}T${String(hour - 2).padStart(2, '0')}:00:00Z`, eventType: 'pending', note: 'Order created' }];
      const statusOrder = ['pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete'];
      const statusIdx = statusOrder.indexOf(status);
      for (let s = 1; s <= statusIdx; s++) {
        events.push({ timestamp: `${dateStr}T${String(hour - 2 + s).padStart(2, '0')}:${15 * s}:00Z`, eventType: statusOrder[s] });
      }

      const order = {
        plantId: plant,
        ticketNumber,
        customerId: cust.id, customerName: cust.name,
        jobSiteId: cust.siteId, jobSiteName: cust.siteName, jobSiteAddress: cust.siteAddr,
        jobSiteLatitude: cust.lat, jobSiteLongitude: cust.lng,
        mixDesignId: mix.id, mixDesignName: mix.name, psi: mix.psi,
        volume, slump, pourType,
        requestedTime: `${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`,
        status, isHotLoad,
        events,
      };

      // Assign truck for non-pending orders
      if (statusIdx >= 1) {
        order.assignedTruckId = truck.id;
        order.assignedTruckNumber = truck.num;
        order.driverName = truck.driver;
      }

      const orderDateStr = order.requestedTime.slice(0, 10);
      allOrders.push({
        ...order,
        orderDateTicket: `${orderDateStr}#${ticketNumber}`,
        createdAt: events[0].timestamp,
        updatedAt: events.at(-1).timestamp,
      });
    }
  }

  return allOrders;
}

// ─── Batch write helper ───────────────────────────────────────────────────

/**
 * Write items to DynamoDB using BatchWriteItem.
 * BatchWriteItem accepts up to 25 items per call.
 */
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

    // Handle unprocessed items (capacity throttling)
    const unprocessed = response.UnprocessedItems?.[tableName];
    if (unprocessed?.length > 0) {
      console.warn(`⚠  ${unprocessed.length} unprocessed items in ${tableName} — retrying`);
      await new Promise((r) => setTimeout(r, 1000));
      await client.send(new BatchWriteItemCommand({
        RequestItems: { [tableName]: unprocessed },
      }));
    }
  }
}

// ─── Clear tables ─────────────────────────────────────────────────────────

async function clearTable(tableName, keyNames) {
  console.log(`🗑  Clearing ${tableName}...`);
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
  console.log(`\n🌱 ReadyMix DynamoDB Seed Script`);
  console.log(`   Environment: ${ENV}`);
  console.log(`   Region:      ${REGION}`);
  console.log(`   Date:        ${TODAY}`);
  console.log('');

  if (CLEAR_MODE) {
    await clearTable(TABLES.orders, ['plantId', 'orderDateTicket']);
    await clearTable(TABLES.trucks, ['truckId']);
    await clearTable(TABLES.plants, ['plantId']);
    console.log('');
  }

  // Seed Plants
  console.log(`📍 Seeding ${PLANTS.length} plants → ${TABLES.plants}`);
  await batchWrite(TABLES.plants, PLANTS);
  console.log(`   ✓ Plants seeded`);

  // Seed Trucks
  console.log(`🚛 Seeding ${TRUCKS.length} trucks → ${TABLES.trucks}`);
  await batchWrite(TABLES.trucks, TRUCKS);
  console.log(`   ✓ Trucks seeded`);

  // Seed today's detailed orders (with realistic statuses and events)
  const todayOrders = makeOrders();
  console.log(`📋 Seeding ${todayOrders.length} detailed orders for today (${TODAY}) → ${TABLES.orders}`);
  await batchWrite(TABLES.orders, todayOrders);
  console.log(`   ✓ Today's orders seeded`);

  // Seed orders for April 8-24 range
  const rangeOrders = makeOrdersForRange('2026-04-08', '2026-04-24');
  // Filter out today's orders (already seeded with detailed data above)
  const futureOrders = rangeOrders.filter(o => o.requestedTime.slice(0, 10) !== TODAY);
  console.log(`📋 Seeding ${futureOrders.length} orders for Apr 8-24 → ${TABLES.orders}`);
  await batchWrite(TABLES.orders, futureOrders);
  console.log(`   ✓ Range orders seeded`);

  console.log('\n✅ Seed complete!\n');
  console.log('Test the API:');
  console.log(`  curl "<API_URL>/orders?plantId=PLANT-001&date=${TODAY}"`);
  console.log(`  curl "<API_URL>/orders?plantId=PLANT-001&date=2026-04-15"`);
  console.log(`  curl "<API_URL>/fleet?plantId=PLANT-001"`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
