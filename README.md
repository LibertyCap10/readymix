# ReadyMix Dashboard

A concrete delivery dispatch and fleet management dashboard — the kind of internal tool a ready-mix concrete producer uses daily to manage orders, assign trucks, and track cycle times. Built as an interview prep project to cover the full stack of a target role: React, Material UI, AG Grid/Charts, AWS Lambda, DynamoDB, Aurora PostgreSQL, and CloudWatch.

---

## What It Does

| View | Description |
|---|---|
| **Dispatch Board** | Today's delivery orders grouped by status, filterable by date and status. Assign trucks, update status, and create new orders from a form-validated dialog. Click any row to open a full-detail drawer with customer info, mix design, and status timeline. |
| **Fleet View** | Live truck status updated every 10 seconds. Three AG Charts panels (bar: status distribution, line: 7-day cycle time trend, donut: fleet utilization %). AG Grid truck roster showing driver, capacity, current job site, and last washout. |
| **Analytics** | *(Phase 6)* Historical volume trends, on-time delivery rates, and customer reports from Aurora PostgreSQL. |

---

## Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Material UI v6 (custom theme: slate gray `#37474F` + safety orange `#FF6D00`)
- AG Grid v35 Community — dispatch board with status-grouped rows and custom cell renderers
- AG Charts v13 Community — bar, line, and donut charts
- Storybook — component library documentation
- Jest + React Testing Library — 93 tests across 13 suites

**Backend** *(Phases 4–6)*
- AWS SAM — infrastructure as code
- AWS Lambda (Node.js ESM) — three microservices: Orders, Fleet, Analytics
- Amazon DynamoDB — hot operational data (active orders, real-time truck status, event log)
- Amazon Aurora Serverless v2 PostgreSQL — relational master data and delivery history
- Amazon API Gateway — REST API routing
- Amazon CloudWatch — structured logging, custom metrics, alarms

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           FRONTEND                               │
│         React 18 + MUI v6 + AG Grid v35 + AG Charts v13         │
│         Vite dev server  ·  Storybook  ·  Jest + RTL            │
│                                                                   │
│   /dispatch          /fleet             /analytics               │
│   DispatchPage       FleetPage          AnalyticsPage            │
│   ├─ DispatchGrid    ├─ FleetStatusChart  (Phase 6)              │
│   ├─ MobileOrderList ├─ CycleTimeChart                           │
│   ├─ NewOrderDialog  ├─ UtilizationChart                         │
│   └─ OrderDrawer     └─ TruckRoster                              │
│                                                                   │
│   Data hooks: useOrders · useFleet · useAnalytics                │
│   (Phase 1–3: mock data  ·  Phase 6: real API calls)            │
└─────────────────────────────┬───────────────────────────────────┘
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
│          │  │              Aurora PostgreSQL                  │
│ DynamoDB │  │              (Serverless v2)                    │
│          │  │                                                  │
│ Active   │  │  customers, plants, drivers, trucks (master)    │
│ Orders   │  │  mix_designs, ingredients, admixtures           │
│          │  │  delivery_history, delivery_events              │
│ Truck    │  │                                                  │
│ Status   │  │  Analytics queries: cycle time trends,          │
│          │  │  on-time rates, volume by customer              │
│ Event    │  └────────────────────────────────────────────────┘
│ Log      │
└──────────┘
      │
      └──────────── CloudWatch (logs · metrics · alarms)
```

### Data Architecture: Polyglot Persistence

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

### Three Microservices

| Service | Owns | DynamoDB ops | Aurora ops |
|---|---|---|---|
| **Orders** | Delivery tickets | Read/write active orders; append events | Validate FKs; archive to delivery_history; customer search |
| **Fleet** | Trucks + drivers | Read/write real-time status | Read master truck + driver data; merge with live status |
| **Analytics** | Reporting | Real-time dispatch state | Volume trends, cycle times, on-time rates (SQL + window functions) |

---

## Build Phases

### ✅ Phase 1 — Foundations
*React + Vite + TypeScript scaffold, MUI theme, Storybook, Jest, mock data*

- Custom MUI theme (`ThemeProvider`, slate/orange palette, shared `statusColors`)
- Reusable components with full test + story coverage:
  - `StatusChip` — colored badge for order and truck statuses
  - `TruckCard` — fleet member summary with live-status indicator
  - `PlantSelector` — Autocomplete dropdown for switching batch plants
- Mock data fixtures: 20 orders, 8 trucks, 2 plants, 10 customers, 4 mix designs
- `PlantContext` — selected plant persisted to `localStorage`, available app-wide

### ✅ Phase 2 — Dispatch Board
*AG Grid v35, custom cell renderers, drawer, responsive mobile view*

- `DispatchGrid` — AG Grid with status-grouped rows using injected full-width header rows (Community edition alternative to Enterprise row grouping). Columns: Ticket #, Customer, Job Site, Mix Design, Volume, Slump, Req. Time, Truck/Driver, Status.
- `OrderDetailDrawer` — MUI Drawer (420px) with customer info, order details, truck assignment, mix design, and `StatusTimeline` stepper
- `NewOrderDialog` — controlled form with Autocomplete customer typeahead, job-site select (filtered by customer), mix design, volume/slump validation, DateTimePicker, hot-load switch
- `MobileOrderList` — card-based view, rendered below `md` breakpoint via `useMediaQuery`
- `orderValidation.ts` — pure validation functions for form and business rules
- `useOrders` hook — data layer with mock data; Phase 6 swaps internals to API calls without changing the component interface

### ✅ Phase 3 — Fleet View
*AG Charts v13, live-ticker simulation, fleet roster*

- `FleetStatusChart` — bar chart; per-bar `itemStyler` colors bars by truck status
- `CycleTimeChart` — line chart with 90-min benchmark `crossLines` reference line
- `UtilizationChart` — donut chart; `innerLabels` shows utilization % in center hole
- `TruckRoster` — AG Grid with live-updated status column, driver cert display, maintenance chip
- `useFleetTicker` — `setInterval`-based status simulator; one truck advances per tick; resets on plant switch
- `useFleet` / `useAnalytics` — data hooks; Phase 6 swaps to polling GET endpoints

### ✅ Phase 4 — AWS Backend: DynamoDB
*SAM template, Lambda handlers, DynamoDB table design, seeding scripts*

- `backend/template.yaml` — SAM template: 3 DynamoDB tables (Orders, Trucks, Plants) with GSIs, 3 Lambda functions, shared layer, API Gateway, CloudWatch alarms and dashboard
- `layers/shared/nodejs/dynamo-client.mjs` — DynamoDB Document Client wrapper, `canTransition()` status validation, table name constants
- `layers/shared/nodejs/response.mjs` — CORS-aware HTTP response helpers (`ok`, `created`, `badRequest`, `notFound`, `conflict`, `serverError`), request parsing
- `services/orders/` — GET/POST/PATCH orders; status transition enforcement; event log append; optimistic concurrency via conditional expressions
- `services/fleet/` — GET fleet by plant + status filter; GET single truck; PATCH real-time truck status
- `services/analytics/` — GET volume, utilization, cycle-times (Phase 4: DynamoDB aggregation; Phase 5: replaced by Aurora SQL)
- `scripts/seed-dynamodb.mjs` — seeds all three tables with data matching the frontend mocks (2 plants, 8 trucks, 14 orders)
- Unit tests for all handlers and shared utilities (`aws-sdk-client-mock`); `canTransition` test suite mirrors frontend test coverage

### 🔲 Phase 5 — AWS Backend: Aurora PostgreSQL
*Aurora Serverless v2, RDS Data API, relational schema, analytics queries*

- Aurora Serverless v2 cluster provisioned via SAM template
- Full schema: customers, plants, trucks, drivers, mix_designs, delivery_history, delivery_events
- RDS Data API access from Lambda (no VPC, no connection pool)
- Analytics service: cycle time trends, utilization, on-time delivery rates (SQL + window functions)
- CloudWatch: structured JSON logging, custom metrics, Lambda error alarms

### 🔲 Phase 6 — Integration + Polish
*Wire frontend to real API, loading states, error boundaries, accessibility*

- Replace mock data hooks with `fetch` calls to API Gateway; `useOrders`, `useFleet`, `useAnalytics` internals swap — no component changes required
- MUI `Skeleton` loading states
- React error boundaries
- Debounced customer typeahead against Aurora
- Responsive audit at 320 / 768 / 1024 / 1440px
- Accessibility: AG Grid keyboard nav, chart ARIA labels, drawer focus management
- Test coverage target: 70%+ business logic, 50%+ overall

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
│   │   │   ├── OrderDetailDrawer/        # Order detail side panel + StatusTimeline
│   │   │   ├── PlantSelector/            # Plant Autocomplete dropdown
│   │   │   ├── StatusChip/               # Order + truck status badges
│   │   │   └── TruckCard/                # Fleet member summary card
│   │   ├── context/
│   │   │   └── PlantContext.tsx          # Selected plant; localStorage persistence
│   │   ├── features/
│   │   │   ├── dispatch/                 # DispatchPage, DispatchGrid, MobileOrderList,
│   │   │   │   ├── cellRenderers/        # NewOrderDialog, orderValidation, columnDefs
│   │   │   │   └── ...                   # cell renderers: Status, TruckAssignment, Time, HotLoad
│   │   │   └── fleet/                    # FleetPage, FleetStatusChart, CycleTimeChart,
│   │   │       └── ...                   # UtilizationChart, TruckRoster, useFleetTicker
│   │   ├── hooks/
│   │   │   ├── useOrders.ts              # Active orders data layer
│   │   │   ├── useFleet.ts               # Trucks with live statuses
│   │   │   └── useAnalytics.ts           # Cycle time + utilization data
│   │   ├── mocks/                        # Mock fixtures (replaced in Phase 6)
│   │   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   │   ├── orders.ts / trucks.ts     # 20 orders, 8 trucks
│   │   │   ├── customers.ts              # 10 customers with job sites + contacts
│   │   │   ├── plants.ts / mixDesigns.ts # 2 plants, 4 mix designs
│   │   │   ├── cycleTimeHistory.ts       # 7-day cycle time trend data
│   │   │   └── deliveryHistory.ts        # Utilization data by plant
│   │   └── theme/
│   │       ├── theme.ts                  # MUI ThemeProvider config
│   │       └── statusColors.ts           # Status → color/label map (orders + trucks)
│   ├── .storybook/                       # Storybook config + global ThemeProvider decorator
│   ├── jest.config.ts
│   └── package.json
├── backend/                              # Phase 4 ✅ — Phase 5 DynamoDB+Aurora coming
│   ├── template.yaml                     # SAM template (Lambda + DynamoDB + API GW + CloudWatch)
│   ├── samconfig.toml                    # SAM deployment config (fill in after --guided)
│   ├── package.json                      # Jest config + devDependencies for backend tests
│   ├── services/
│   │   ├── orders/                       # GET/POST/PATCH orders; event log; optimistic locking
│   │   │   ├── index.mjs
│   │   │   └── index.test.mjs
│   │   ├── fleet/                        # GET fleet roster; PATCH real-time truck status
│   │   │   ├── index.mjs
│   │   │   └── index.test.mjs
│   │   └── analytics/                    # GET volume, utilization, cycle-times
│   │       └── index.mjs
│   ├── layers/shared/nodejs/             # Shared DynamoDB client, response helpers, canTransition
│   │   ├── dynamo-client.mjs
│   │   └── response.mjs
│   └── scripts/
│       └── seed-dynamodb.mjs             # Seed all 3 tables with data matching frontend mocks
├── database/                             # Phase 5
│   ├── schema.sql                        # Full Aurora PostgreSQL schema
│   └── seed.sql                          # Reference data seed
└── docs/
    ├── project-overview.md               # Domain primer, data architecture, API routes
    ├── aws-setup.md                      # AWS deployment walkthrough (SAM CLI → production)
    ├── aws-setup-aurora.md               # Aurora Serverless v2 provisioning guide
    └── review/                           # Deep-dive notes on every major technology
        ├── 01-react-vite-typescript.md
        ├── 02-material-ui-theming.md
        ├── 03-storybook-overview.md
        ├── 04-ag-grid-deep-dive.md
        ├── 05-react-patterns.md
        ├── 06-ag-charts-overview.md
        ├── 07-sam-infrastructure-as-code.md
        ├── 08-dynamodb-data-modeling.md
        └── 09-lambda-architecture.md
```

---

## Getting Started

### Prerequisites

```bash
node --version   # 20+
aws --version    # AWS CLI (for Phases 4–5)
sam --version    # SAM CLI (for Phases 4–5)
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
npm test           # 93 tests, 13 suites
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

*Phase 4–5 — not yet implemented. Endpoints documented here for planning.*

### Orders Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/orders?plantId&date&status` | DynamoDB | Today's active orders for the dispatch board |
| `GET` | `/orders/:ticketId` | DynamoDB | Single active order |
| `GET` | `/orders/:ticketId/detail` | Aurora + DynamoDB | Full detail: customer info, mix ingredients, event timeline |
| `POST` | `/orders` | DynamoDB + Aurora | Create ticket (FK-validate customer/plant/mix against Aurora) |
| `PATCH` | `/orders/:ticketId` | DynamoDB | Update status, assign truck, add note |
| `POST` | `/orders/:ticketId/complete` | DynamoDB → Aurora | Archive to `delivery_history`; remove active record |

### Fleet Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/fleet?plantId` | Aurora + DynamoDB | Roster: master data merged with live status |
| `GET` | `/fleet/status?plantId` | DynamoDB | Real-time status only (for the live ticker polling) |
| `PATCH` | `/fleet/:truckId/status` | DynamoDB | Update real-time status and location |
| `GET` | `/drivers?plantId` | Aurora | Drivers at a plant with certifications |

### Analytics Service

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/analytics/volume?plantId&range` | Aurora | Daily delivery volume aggregation |
| `GET` | `/analytics/utilization?plantId` | Aurora | Productive / idle / maintenance hours |
| `GET` | `/analytics/cycle-times?plantId` | Aurora | Avg cycle time trend (window functions) |
| `GET` | `/analytics/customers?plantId` | Aurora | Top customers by volume + on-time rate |

### Reference Data

| Method | Route | DB | Description |
|---|---|---|---|
| `GET` | `/customers/search?q` | Aurora | Debounced typeahead for the New Order form |
| `GET` | `/mix-designs?plantId` | Aurora | Available mix designs for a plant |
| `GET` | `/plants` | Aurora | All plants |

---

## Review Docs

Each `docs/review/` file explains a major technology used in this project — what it is, why we chose it over alternatives, how we used it, and interview talking points:

| Doc | Covers |
|---|---|
| [`01-react-vite-typescript.md`](docs/review/01-react-vite-typescript.md) | React 18, Vite build tooling, TypeScript config, JSX transform |
| [`02-material-ui-theming.md`](docs/review/02-material-ui-theming.md) | MUI ThemeProvider, `sx` prop, palette customization, `statusColors` pattern |
| [`03-storybook-overview.md`](docs/review/03-storybook-overview.md) | CSF3 stories, decorators, args, why Storybook complements Jest |
| [`04-ag-grid-deep-dive.md`](docs/review/04-ag-grid-deep-dive.md) | Community vs Enterprise, column defs, cell renderers, module registration (v33+), themeQuartz, full-width rows for status grouping |
| [`05-react-patterns.md`](docs/review/05-react-patterns.md) | Custom hooks as data layer, controlled forms, `useCallback`/`useMemo`, responsive design, component composition |
| [`06-ag-charts-overview.md`](docs/review/06-ag-charts-overview.md) | AG Charts vs Recharts/Victory, `AgChartOptions` object shape, bar `itemStyler`, line `crossLines`, donut `innerLabels`, module registration (v13+), testing strategy |
