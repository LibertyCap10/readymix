# ReadyMix Dashboard

A concrete delivery dispatch and fleet management dashboard — the kind of internal tool a ready-mix concrete producer uses daily to manage orders, assign trucks, and track cycle times. Built as an interview prep project to cover the full stack of a target role: React, Material UI, AG Grid/Charts, AWS Lambda, DynamoDB, Aurora PostgreSQL, and CloudWatch.

---

## What It Does

| View | Description |
|---|---|
| **Orders Board** | Today's delivery orders grouped by status, filterable by date and status. Assign trucks, update status, and create new orders from a form-validated dialog. Click any row to open a full-detail drawer with customer info, mix design, and status timeline. |
| **Dispatch Map** | Mapbox-powered real-time map view of today's deliveries. Plant, truck, and job-site markers with status-colored indicators. Driving routes from Mapbox Directions API for dispatched/in-transit orders. One-click truck assignment, status updates, and cancellation from map popups. Collapsible side panel on desktop, bottom sheet on mobile. |
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
│                           FRONTEND                              │
│         React 18 + MUI v6 + AG Grid v35 + AG Charts v13         │
│         Vite dev server  ·  Storybook  ·  Jest + RTL            │
│                                                                 │
│  /mixes        /fleet          /orders         /dispatch        /analytics    │
│  MixesPage     FleetPage       OrdersPage      DispatchMapPage  AnalyticsPage │
│  ├─ MixGrid    ├─ StatusChart  ├─ OrderGrid    ├─ MapView (Mapbox)            │
│  ├─ MixCards   ├─ CycleChart   ├─ MobileList   ├─ SidePanel / BottomSheet     │
│  ├─ MixForm    ├─ UtilChart    ├─ NewOrder     ├─ AssignTruckDialog           │
│  └─ MixDrawer  └─ TruckRoster └─ OrderDrawer  └─ Route lines + popups        │
│                                                                               │
│  Data hooks: useMixDesigns · useFleet · useOrders · useDispatchMap · useAnalytics │
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
│          │  │              Aurora PostgreSQL                 │
│ DynamoDB │  │              (Serverless v2)                   │
│          │  │                                                │
│ Active   │  │  customers, plants, drivers, trucks (master)   │
│ Orders   │  │  mix_designs, ingredients, admixtures          │
│          │  │  delivery_history, delivery_events             │
│ Truck    │  │                                                │
│ Status   │  │  Analytics queries: cycle time trends,         │
│          │  │  on-time rates, volume by customer             │
│ Event    │  └────────────────────────────────────────────────┘
│ Log      │
└──────────┘
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

### Three Microservices

| Service | Owns | DynamoDB ops | Aurora ops |
|---|---|---|---|
| **Orders** | Delivery tickets | Read/write active orders; append events | Validate FKs; archive to delivery_history; customer search |
| **Fleet** | Trucks + drivers | Read/write real-time status | Read master truck + driver data; merge with live status |
| **Analytics** | Reporting | Real-time dispatch state | Volume trends, cycle times, on-time rates (SQL + window functions) |

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
│   │   │   ├── dispatch/                 # OrdersPage (AG Grid order board),
│   │   │   │   ├── cellRenderers/        # NewOrderDialog, orderValidation, columnDefs
│   │   │   │   └── ...                   # cell renderers: Status, TruckAssignment, Time, HotLoad
│   │   │   ├── dispatch-map/             # DispatchMapPage (Mapbox map), MapView,
│   │   │   │   └── ...                   # SidePanel, BottomSheet, AssignTruckDialog, hooks
│   │   │   ├── mixes/                    # MixesPage, MixDesignGrid, MobileMixList,
│   │   │   │   └── ...                   # MixDesignDetailDrawer, MixDesignFormDialog
│   │   │   ├── fleet/                    # FleetPage, FleetStatusChart, CycleTimeChart,
│   │   │   │   └── ...                   # UtilizationChart, TruckRoster, useFleetTicker
│   │   │   └── analytics/               # AnalyticsPage, KpiCards, VolumeChart,
│   │   │       └── ...                   # CycleTimeChart, CustomerTable, DriverTable
│   │   ├── hooks/
│   │   │   ├── useOrders.ts              # Active orders data layer
│   │   │   ├── useMixDesigns.ts          # Mix design CRUD + filtering
│   │   │   ├── useFleet.ts               # Trucks with live statuses
│   │   │   ├── useAnalytics.ts           # Cycle time + utilization data
│   │   │   └── useAnalyticsDashboard.ts  # Dashboard analytics data
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
├── backend/                              
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
├── database/                             
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

NOTE TO SELF:   
Serverless Aurora v2 is expensive (~$43/month).  Be sure to turn it down when not in-use: 

```bash
aws rds stop-db-cluster --db-cluster-identifier readymix-aurora-dev
```

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

### Common Commands

```bash
### AWS ###
aws s3 mb s3://my-bucket             # make a new bucket
aws s3 ls                            # list all buckets
aws s3 ls s3://my-bucket/            # list objects in a bucket
aws s3 rm s3://my-bucket/file.zip    # delete an object
aws s3 rb s3://my-bucket --force     # remove a bucket and all its contents
aws configure
aws sts get-caller-identity

# post-deploy verification of output from template.yaml
aws cloudformation describe-stacks \
  --stack-name readymix-dashboard-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text 

### SAM ###
sam build                           # compile and prepare your Lambda functions and layers
sam local start-api                 # spin up a local API Gateway for testing
sam validate                        # check your template.yaml for errors
sam package --s3-bucket my-bucket --output-template-file packaged.yaml # package artifacts and upload to S3 (older workflow, sam deploy --guided handles this now)
sam deploy --guided                 # interactive first-time deploy (creates/uses a samconfig.toml for future runs)
sam deploy                          # deploy using saved samconfig.toml settings
sam delete --stack-name my-stack    # tear down the entire CloudFormation stack

### FLAGS FOR BOTH ###
--profile my-profile          # use a named AWS credentials profile
--region us-east-1            # target a specific region
--no-confirm-changeset        # skip the changeset approval prompt on deploy
```

### Running locally 

```bash

----------------------
0. Install pre-reqs
----------------------

brew install awscli
brew install aws-sam-cli
brew install libpq

# also add libpq to PATH: 
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

             

----------------------
1. Start databases
----------------------

# DynamoDB Local
docker run -d -p 8000:8000 amazon/dynamodb-local

# PostgreSQL (local Aurora stand-in)
docker run -d --name readymix-pg \
  -e POSTGRES_USER=readymix_admin \
  -e POSTGRES_PASSWORD=localdev123 \
  -e POSTGRES_DB=readymix \
  -p 5432:5432 postgres:15

----------------------
2. Load data
----------------------

# Aurora schema + seed data
psql postgresql://readymix_admin:localdev123@localhost:5432/readymix \
  -f database/schema.sql

# Optiona: if there's an issue with Aurora, drop and recreate. Then re-seed data using above command
psql postgresql://readymix_admin:localdev123@localhost:5432/postgres \
  -c "DROP DATABASE readymix;" -c "CREATE DATABASE readymix;"

# DynamoDB seed (after SAM local is running or tables exist)
cd backend/scripts && node seed-dynamodb.mjs

---------------------------
3. Create backend/env.json
---------------------------
{
  "OrdersFunction": {
    "ORDERS_TABLE": "readymix-orders-dev",
    "TRUCKS_TABLE": "readymix-trucks-dev",
    "PLANTS_TABLE": "readymix-plants-dev",
    "AWS_ENDPOINT_URL": "http://host.docker.internal:8000"
  },
  "FleetFunction": {
    "ORDERS_TABLE": "readymix-orders-dev",
    "TRUCKS_TABLE": "readymix-trucks-dev",
    "PLANTS_TABLE": "readymix-plants-dev",
    "AWS_ENDPOINT_URL": "http://host.docker.internal:8000"
  },
  "AnalyticsFunction": {
    "USE_LOCAL_PG": "true",
    "PG_CONNECTION_STRING": "postgresql://readymix_admin:localdev123@host.docker.internal:5432/readymix"
  }
}

----------------------
4. Start backend
----------------------

cd backend
sam build
sam local start-api --port 3001 --env-vars env.json --warm-containers EAGER

----------------------
5. Start frontend
----------------------

cd frontend
npm install
# Create .env.local pointing to local API + Mapbox token:
echo "VITE_API_URL=http://localhost:3001" > .env.local
echo "VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here" >> .env.local
npm run dev    # http://localhost:3000

-------------------------------
6. When finished --- Tear down
-------------------------------

# Stop SAM local API (Ctrl+C in its terminal), then:

# Stop and remove database containers
docker stop readymix-pg && docker rm readymix-pg
docker stop $(docker ps -q --filter ancestor=amazon/dynamodb-local) && \
docker rm $(docker ps -aq --filter ancestor=amazon/dynamodb-local)

# Optional: remove images to free disk space
docker rmi postgres:15 amazon/dynamodb-local
```

### Backend Build and Deploy

```bash

sam build && sam deploy

```


### Frontend Build and Deploy

```bash 

cd frontend && npm run build

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name readymix-dashboard \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

aws s3 sync dist/ s3://$BUCKET --delete

# CloudFront cache invalidation
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name readymix-dashboard \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"

# Get CloudFront URL
aws cloudformation describe-stacks \
  --stack-name readymix-dashboard-dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text

  ```


  ### Concise Backend & Frontend Build and Deploy

  ```bash
  cd backend && sam build && sam deploy

cd ../frontend && npm run build
aws s3 sync dist/ s3://readymix-frontend-dev --delete
aws cloudfront create-invalidation --distribution-id E3PP93ZEFWRQHE --paths "/*"
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
| `GET` | `/plants` | Aurora | All plants |

