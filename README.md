# ReadyMix Dashboard

A concrete delivery dispatch and fleet management dashboard — the kind of internal tool a ready-mix concrete producer uses daily to manage orders, assign trucks, and track cycle times. Full-stack: React + Material UI + AG Grid/Charts on the frontend, AWS Lambda + DynamoDB + Aurora PostgreSQL on the backend.

**Live at [readymix.earth](https://readymix.earth)**

---

## What It Does

| View | Description |
|---|---|
| **Landing Page** | Public-facing feature showcase with animated Mapbox demo map. Entry point at `/`. |
| **Orders Board** | Today's delivery orders grouped by status, filterable by date and status. Assign trucks, update status, delete orders, and create new orders from a form-validated dialog. Click any row to open a full-detail drawer with customer info, mix design, and status timeline. |
| **Dispatch Map** | Mapbox-powered real-time map view of today's deliveries. Plant, truck, and job-site markers with status-colored indicators. Driving routes from Mapbox Directions API for dispatched/in-transit orders. One-click truck assignment, status updates, and cancellation from map popups. Collapsible side panel on desktop, bottom sheet on mobile. Toggle to a **Schedule Gantt** view showing each truck as a row with time-positioned order blocks, a now marker, and an unassigned orders sidebar. |
| **Mix Designs** | Browse, create, and edit concrete mix recipes. AG Grid table with PSI, slump range, cost, and recommended application tags (driveway, foundation, sidewalk, etc.). Click any row for a full ingredient/admixture breakdown. Filter by application type or toggle inactive mixes. |
| **Fleet View** | Live truck status updated every 10 seconds. Three AG Charts panels (bar: status distribution, line: 7-day cycle time trend, donut: fleet utilization %). AG Grid truck roster showing driver, capacity, current job site, and last washout. |
| **Analytics** | Historical volume trends, on-time delivery rates, and customer reports from Aurora PostgreSQL. |

---

## Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Material UI v6 (custom theme: slate gray `#37474F` + safety orange `#FF6D00`)
- AG Grid v35 Community — dispatch board with status-grouped rows and custom cell renderers
- AG Charts v13 Community — bar, line, and donut charts
- Mapbox GL JS + react-map-gl — dispatch map with real-time truck tracking and driving routes
- Storybook — component library documentation
- Jest + React Testing Library

**Backend**
- AWS SAM — infrastructure as code
- AWS Lambda (Node.js 20 ESM, ARM64) — four services: Orders, Fleet, Analytics, Ticker
- Amazon DynamoDB — hot operational data (active orders, real-time truck status)
- Amazon Aurora Serverless v2 PostgreSQL — relational master data and delivery history
- Amazon API Gateway — REST API routing
- Amazon EventBridge — 1-minute schedule driving the Ticker lifecycle engine
- Amazon CloudFront + S3 — frontend CDN with custom domain (readymix.earth)
- Amazon CloudWatch — structured logging, custom metrics, alarms

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                                                │
│         React 18 + MUI v6 + AG Grid v35 + AG Charts v13                                           │
│         Vite dev server  ·  Storybook  ·  Jest + RTL                                              │
│                                                                                                   │
│  /             /mixes        /fleet          /orders         /dispatch        /analytics          │
│  LandingPage   MixesPage     FleetPage       OrdersPage      DispatchMapPage  AnalyticsPage       │
│  ├─ MixGrid    ├─ StatusChart  ├─ OrderGrid    ├─ MapView (Mapbox)                                │
│  ├─ MixCards   ├─ CycleChart   ├─ MobileList   ├─ SidePanel / BottomSheet                         │
│  ├─ MixForm    ├─ UtilChart    ├─ NewOrder     ├─ ScheduleGantt (Gantt view)                      │
│  └─ MixDrawer  └─ TruckRoster └─ OrderDrawer  └─ Route lines + popups                             │
│                                                                                                   │
│  Data hooks: useMixDesigns · useFleet · useOrders · useDispatchMap · useAnalytics                 │
│  Simulation engine: timeline-driven order lifecycle + route interpolation                         │
└─────────────────────────────┬─────────────────────────────────────────────────────────────────────┘
                              │ REST / JSON
                              │ AWS API Gateway
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
          ┌──────────┐  ┌──────────┐  ┌──────────────┐
          │  Orders  │  │  Fleet   │  │  Analytics   │
          │  Service │  │  Service │  │  Service     │
          │  Lambda  │  │  Lambda  │  │  Lambda      │
          └────┬─────┘  └────┬─────┘  └──────┬───────┘
               │             │               │
      ┌────────┴──┐     ┌────┴──────┐   ┌───┴──────────────┐
      ▼           ▼     ▼           ▼   ▼                  ▼
┌──────────┐  ┌────────────────────────────────────────────────┐
│          │  │              Aurora PostgreSQL                 │
│ DynamoDB │  │              (Serverless v2)                   │
│          │  │                                                │
│ Active   │  │  customers, plants, drivers, trucks (master)   │
│ Orders   │  │  mix_designs, ingredients, admixtures          │
│          │  │  delivery_history, delivery_events             │
│ Truck    │  │                                                │
│ Status   │  │  Analytics queries: cycle time trends,         │
│          │  │  on-time rates, volume by customer             │
└──────────┘  └────────────────────────────────────────────────┘
      ▲
      │  every 1 min
┌─────┴──────┐
│  Ticker    │◄──── EventBridge (1-min schedule)
│  Lambda    │      Advances order/truck lifecycle
└────────────┘
      │
      └──────────── CloudWatch (logs · metrics · alarms)
```

### Data Architecture

Two databases, each matched to its access pattern:

| Data | Store | Reason |
|---|---|---|
| Today's active orders | DynamoDB | Sub-millisecond key lookups; high-frequency status writes |
| Real-time truck status | DynamoDB | Last-write-wins; no joins; GPS pings every few seconds |
| Order event log | DynamoDB | Append-only; time-sorted; never updated after write |
| Customers, contacts, job sites | Aurora PostgreSQL | Relational hierarchy; foreign key validation |
| Mix designs + ingredients | Aurora PostgreSQL | Many-to-many; a mix has many ingredients |
| Trucks (master) + drivers | Aurora PostgreSQL | Identity records with certifications and history |
| Completed delivery history | Aurora PostgreSQL | JOIN-heavy analytics; window functions for trends |
| Pricing + invoicing | Aurora PostgreSQL | ACID transactions; referential integrity |

**The lifecycle:** When an order is created, the Lambda validates customer/mix design/plant FKs against Aurora, then writes the active order to DynamoDB. Every status change updates DynamoDB and appends to the event log. On completion, the full record is archived to Aurora's `delivery_history` table (with all FKs intact) and removed from DynamoDB.

### Four Services

| Service | Owns | Trigger | Description |
|---|---|---|---|
| **Orders** | Delivery tickets | API Gateway | CRUD for active orders; FK validation against Aurora; customer search; mix design management |
| **Fleet** | Trucks + drivers | API Gateway | Real-time truck status reads/writes; merges DynamoDB live status with Aurora master data |
| **Analytics** | Reporting | API Gateway | Volume trends, cycle times, on-time rates, customer/driver reports (Aurora SQL + window functions) |
| **Ticker** | Lifecycle engine | EventBridge (1 min) | Advances orders through status phases based on stored timelines; updates truck positions and status |

---

## Project Structure

```
readymix/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                       # Route definitions
│   │   ├── AppLayout.tsx                 # AppBar + nav tabs + PlantSelector
│   │   ├── main.tsx                      # React root; registers AG Grid + AG Charts modules
│   │   ├── components/
│   │   │   ├── DetailRow.tsx             # Label–value row for detail drawers
│   │   │   ├── EmptyState.tsx            # Illustration + message for empty views
│   │   │   ├── ErrorBoundary.tsx         # Catches render errors per route
│   │   │   ├── LiveClock.tsx             # Real-time clock display
│   │   │   ├── Logo.tsx                  # ReadyMix logo component
│   │   │   ├── OrderDetailDrawer/        # Order detail side panel + StatusTimeline
│   │   │   ├── PageHeader.tsx            # Consistent page title + action bar
│   │   │   ├── PlantSelector/            # Plant Autocomplete dropdown
│   │   │   ├── SectionHeader.tsx         # Section divider with title
│   │   │   ├── SkeletonLoader.tsx        # Loading skeletons for grids and cards
│   │   │   ├── StatusChip/               # Order + truck status badges
│   │   │   └── TruckCard/                # Fleet member summary card
│   │   ├── context/
│   │   │   └── PlantContext.tsx          # Selected plant; localStorage persistence
│   │   ├── features/
│   │   │   ├── analytics/               # AnalyticsPage, KpiCards, VolumeChart,
│   │   │   │   └── ...                   # CycleTimeChart, CustomerTable, DriverTable
│   │   │   ├── dispatch/                 # OrdersPage (AG Grid order board),
│   │   │   │   ├── cellRenderers/        # NewOrderDialog, orderValidation, columnDefs
│   │   │   │   └── ...                   # cell renderers: Status, TruckAssignment, Time, HotLoad
│   │   │   ├── dispatch-map/             # DispatchMapPage (Mapbox map), MapView,
│   │   │   │   └── ...                   # SidePanel, BottomSheet, AssignTruckDialog, ScheduleGantt toggle
│   │   │   ├── fleet/                    # FleetPage, FleetStatusChart, CycleTimeChart,
│   │   │   │   └── ...                   # UtilizationChart, TruckRoster, useFleetTicker
│   │   │   ├── landing/                  # LandingPage, DemoMap (public feature showcase)
│   │   │   ├── mixes/                    # MixesPage, MixDesignGrid, MobileMixList,
│   │   │   │   └── ...                   # MixDesignDetailDrawer, MixDesignFormDialog
│   │   │   ├── schedule/                 # ScheduleGantt, TruckRow, TimeAxis, NowMarker,
│   │   │   │   └── ...                   # ScheduleLegend, UnassignedSidebar
│   │   │   ├── simulation/              # Timeline-driven order lifecycle engine,
│   │   │   │   └── ...                   # route geometry interpolation, SimulationContext
│   │   │   └── timeline/                # TimelineContext provider
│   │   ├── hooks/
│   │   │   ├── useOrders.ts              # Active orders data layer
│   │   │   ├── useMixDesigns.ts          # Mix design CRUD + filtering
│   │   │   ├── useFleet.ts               # Trucks with live statuses
│   │   │   ├── useAnalytics.ts           # Cycle time + utilization data
│   │   │   └── useAnalyticsDashboard.ts  # Dashboard analytics data
│   │   └── theme/
│   │       ├── theme.ts                  # MUI ThemeProvider config
│   │       └── statusColors.ts           # Status → color/label map (orders + trucks)
│   ├── .storybook/                       # Storybook config + global ThemeProvider decorator
│   ├── jest.config.ts
│   └── package.json
├── backend/                              
│   ├── template.yaml                     # SAM template (Lambda + DynamoDB + API GW + CloudWatch)
│   ├── samconfig.toml                    # SAM deployment config (fill in after --guided)
│   ├── package.json                      # Jest config + devDependencies for backend tests
│   ├── services/
│   │   ├── orders/                       # GET/POST/PATCH/DELETE orders; schedule; customer search; mix design CRUD
│   │   │   ├── index.mjs
│   │   │   └── index.test.mjs
│   │   ├── fleet/                        # GET fleet roster; PATCH real-time truck status
│   │   │   ├── index.mjs
│   │   │   └── index.test.mjs
│   │   ├── analytics/                    # GET volume, utilization, cycle-times, customer/driver reports
│   │   │   └── index.mjs
│   │   └── ticker/                       # EventBridge-triggered lifecycle engine (every 1 min)
│   │       └── index.mjs
│   ├── layers/shared/nodejs/             # Shared Lambda layer
│   │   ├── dynamo-client.mjs             # DynamoDB Document Client + command helpers
│   │   ├── aurora-client.mjs             # RDS Data API client for Aurora queries
│   │   └── response.mjs                  # HTTP response helpers
│   └── scripts/
│       └── seed-dynamodb.mjs             # Seed all 3 tables with data matching frontend mocks
├── deploy-aws.sh                          # Full AWS deploy (SAM + S3 + CDN invalidation)
├── deploy-local.sh                        # Local dev: SAM local + seed + Vite dev server
└── database/                             
    ├── schema.sql                        # Full Aurora PostgreSQL schema
    └── seed.sql                          # Reference data seed

```

---

## Getting Started

### Prerequisites

```bash
node --version   # 20+
aws --version    # AWS CLI
sam --version    # SAM CLI
```

### Run the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Run Storybook

```bash
cd frontend
npm run storybook  # http://localhost:6006
```

### Run tests

```bash
cd frontend
npm test           
```

### Running locally

```bash
# Prerequisites: Docker running with DynamoDB Local on :8000
docker run -d -p 8000:8000 amazon/dynamodb-local

# Start everything (SAM build + seed + backend on :3001 + frontend on :3000)
./deploy-local.sh

# Options
./deploy-local.sh --skip-seed   # Skip re-seeding DynamoDB
./deploy-local.sh --seed-only   # Just re-seed and exit
./deploy-local.sh --ticker      # Invoke the ticker Lambda once
```

### Deploy to AWS

```bash
# Full deploy (backend + frontend + CDN invalidation)
./deploy-aws.sh

# Deploy + fresh seed data
./deploy-aws.sh --seed --clear

# Backend only / Frontend only
./deploy-aws.sh --skip-frontend
./deploy-aws.sh --skip-backend
```


---

## Domain Primer

Understanding ready-mix concrete vocabulary helps explain the data model:

| Term | Meaning |
|---|---|
| **Batch Plant** | The facility that mixes concrete. Has mixers, silos (cement/aggregate/sand), and a truck loading area. |
| **Transit Mixer** | The truck with the spinning drum. Carries 8–12 cubic yards per load. |
| **Ticket** | The order document — mix design, volume (yd³), pour type, job site, requested time, slump. |
| **Dispatch** | Assigning a truck + driver to a ticket and scheduling departure. |
| **Slump** | How "wet" the concrete is, measured in inches (2" = stiff, 8" = flowable). Pour type determines the required slump. |
| **Mix Design** | The recipe — identified by PSI strength (3000 / 4000 / 5000 PSI) and aggregate type. Contains multiple ingredients with precise proportions. |
| **Admixture** | A chemical additive (accelerator, retarder, air-entrainer, water-reducer) added to modify concrete properties. |
| **Cycle Time** | Round-trip time: load at plant → drive → pour → return. The core metric dispatchers optimize. |
| **Hot Load** | An urgent, unscheduled delivery. Jumps the queue. |
| **Washout** | Cleaning the drum between loads to prevent hardening. Timestamp tracked per truck. |

---

## API Reference

REST API served by AWS API Gateway + Lambda.

### Orders Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/orders?plantId&date&status` | DynamoDB | Today's active orders for the dispatch board |
| `GET` | `/orders/:ticketId` | DynamoDB | Single active order |
| `POST` | `/orders` | DynamoDB + Aurora | Create ticket (FK-validate customer/plant/mix against Aurora) |
| `PATCH` | `/orders/:ticketId` | DynamoDB | Update status, assign truck, add note |
| `DELETE` | `/orders/:ticketId` | DynamoDB | Delete an order |
| `GET` | `/schedule?plantId&date` | Aurora + DynamoDB | Daily truck schedule for the Gantt view |

### Fleet Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/fleet?plantId` | Aurora + DynamoDB | Roster: master data merged with live status |
| `GET` | `/fleet/:truckId` | DynamoDB | Single truck status |
| `PATCH` | `/fleet/:truckId/status` | DynamoDB | Update real-time status and location |

### Analytics Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/analytics/volume?plantId&range` | Aurora | Daily delivery volume aggregation |
| `GET` | `/analytics/utilization?plantId` | Aurora | Productive / idle / maintenance hours |
| `GET` | `/analytics/cycle-times?plantId` | Aurora | Avg cycle time trend (window functions) |
| `GET` | `/analytics/customers?plantId` | Aurora | Top customers by volume + on-time rate |
| `GET` | `/analytics/drivers?plantId` | Aurora | Driver performance leaderboard |

### Mix Designs Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/mix-designs?plantId&psiMin&psiMax&pourType&includeInactive` | Aurora | List mix designs with filtering (applications, PSI range, active status) |
| `GET` | `/mix-designs/:mixDesignId` | Aurora | Full detail: ingredients, admixtures, applications |
| `POST` | `/mix-designs` | Aurora | Create mix design with ingredients, admixtures, applications (transactional) |
| `PATCH` | `/mix-designs/:mixDesignId` | Aurora | Update mix design fields, replace ingredients/admixtures/applications |
| `PATCH` | `/mix-designs/:mixDesignId/status` | Aurora | Toggle is_active |
| `GET` | `/ingredients` | Aurora | Master ingredient list (for form autocomplete) |
| `GET` | `/admixtures` | Aurora | Master admixture list (for form autocomplete) |

### Reference Data

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/customers/search?q` | Aurora | Debounced typeahead for the New Order form |
| `GET` | `/customers/:customerId/job-sites` | Aurora | Job sites for a customer |
| `GET` | `/plants` | Aurora | All plants |

