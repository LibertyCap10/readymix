-- ============================================================
-- ReadyMix Dashboard — Aurora PostgreSQL Schema
-- ============================================================
-- This schema holds all relational master data and delivery
-- history. DynamoDB handles the hot operational data (active
-- orders, real-time truck status, event log).
--
-- Run this against your Aurora Serverless v2 cluster after
-- provisioning it via the SAM template.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Fuzzy text search (customer typeahead)

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────

CREATE TYPE pour_type AS ENUM (
    'foundation', 'slab', 'wall', 'driveway',
    'sidewalk', 'column', 'footing', 'grade_beam'
);

CREATE TYPE truck_type AS ENUM (
    'rear_discharge', 'front_discharge', 'volumetric'
);

CREATE TYPE certification_type AS ENUM (
    'cdl_class_a', 'cdl_class_b', 'hazmat',
    'tanker', 'osha_10', 'osha_30', 'first_aid'
);

CREATE TYPE order_status AS ENUM (
    'pending', 'dispatched', 'in_transit',
    'pouring', 'returning', 'complete', 'cancelled'
);

CREATE TYPE day_of_week AS ENUM (
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday'
);

-- ────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ────────────────────────────────────────────────────────────
-- A customer is a construction company that orders concrete.
-- They can have multiple contacts and multiple job sites.

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    account_number  TEXT UNIQUE NOT NULL,
    billing_address TEXT,
    city            TEXT,
    state           TEXT,
    zip             TEXT,
    phone           TEXT,
    email           TEXT,
    tax_id          TEXT,
    credit_limit    NUMERIC(12, 2),
    payment_terms   TEXT DEFAULT 'NET30',
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name_trgm ON customers USING GIN (name gin_trgm_ops);
CREATE INDEX idx_customers_account ON customers (account_number);
CREATE INDEX idx_customers_active ON customers (is_active) WHERE is_active = true;

CREATE TABLE customer_contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    title           TEXT,
    phone           TEXT,
    email           TEXT,
    is_primary      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_contacts_customer ON customer_contacts (customer_id);

CREATE TABLE customer_job_sites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,           -- e.g. "Centennial Bank HQ Expansion"
    address         TEXT NOT NULL,
    city            TEXT,
    state           TEXT,
    zip             TEXT,
    lat             NUMERIC(10, 7),
    lng             NUMERIC(10, 7),
    gate_code       TEXT,
    site_contact    TEXT,                    -- on-site foreman name
    site_phone      TEXT,
    special_instructions TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_sites_customer ON customer_job_sites (customer_id);
CREATE INDEX idx_job_sites_name_trgm ON customer_job_sites USING GIN (name gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- PLANTS
-- ────────────────────────────────────────────────────────────
-- A batch plant is where concrete is mixed and loaded onto
-- trucks. A company may operate multiple plants.

CREATE TABLE plants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    code            TEXT UNIQUE NOT NULL,    -- e.g. "PLANT-001"
    address         TEXT,
    city            TEXT,
    state           TEXT,
    zip             TEXT,
    lat             NUMERIC(10, 7),
    lng             NUMERIC(10, 7),
    phone           TEXT,
    truck_capacity  INTEGER,                 -- max trucks based at this plant
    mixer_count     INTEGER,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plant_operating_hours (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id        UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    day             day_of_week NOT NULL,
    open_time       TIME NOT NULL,
    close_time      TIME NOT NULL,
    is_closed       BOOLEAN DEFAULT false,
    UNIQUE (plant_id, day)
);

CREATE INDEX idx_plant_hours_plant ON plant_operating_hours (plant_id);

-- ────────────────────────────────────────────────────────────
-- MIX DESIGNS
-- ────────────────────────────────────────────────────────────
-- A mix design is a concrete recipe. It has a target PSI
-- strength and a list of ingredients with precise proportions.
-- Admixtures are chemical additives that modify the mix.

CREATE TABLE ingredients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,           -- e.g. "Type I/II Portland Cement"
    category        TEXT NOT NULL,           -- cement, aggregate, sand, water, fly_ash
    unit            TEXT NOT NULL,           -- lbs, gallons, cubic_yards
    cost_per_unit   NUMERIC(10, 4),
    supplier        TEXT,
    is_active       BOOLEAN DEFAULT true
);

CREATE TABLE admixtures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,           -- e.g. "Pozzolith 322N"
    type            TEXT NOT NULL,           -- accelerator, retarder, water_reducer, air_entrainer, superplasticizer
    unit            TEXT NOT NULL DEFAULT 'oz',
    cost_per_unit   NUMERIC(10, 4),
    supplier        TEXT,
    is_active       BOOLEAN DEFAULT true
);

CREATE TABLE mix_designs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            TEXT UNIQUE NOT NULL,    -- e.g. "4000PSI-STD"
    name            TEXT NOT NULL,           -- e.g. "4000 PSI Standard"
    psi_rating      INTEGER NOT NULL,
    slump_min       INTEGER DEFAULT 3,       -- inches
    slump_max       INTEGER DEFAULT 6,
    description     TEXT,
    yield_per_batch NUMERIC(6, 2),           -- cubic yards per batch
    cost_per_yard   NUMERIC(10, 2),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mix_designs_psi ON mix_designs (psi_rating);
CREATE INDEX idx_mix_designs_active ON mix_designs (is_active) WHERE is_active = true;

-- Many-to-many: a mix design has many ingredients, each with a
-- specific quantity per cubic yard.
CREATE TABLE mix_design_ingredients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mix_design_id   UUID NOT NULL REFERENCES mix_designs(id) ON DELETE CASCADE,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity        NUMERIC(10, 4) NOT NULL,  -- amount per cubic yard
    unit            TEXT NOT NULL,
    UNIQUE (mix_design_id, ingredient_id)
);

CREATE INDEX idx_mdi_mix ON mix_design_ingredients (mix_design_id);
CREATE INDEX idx_mdi_ingredient ON mix_design_ingredients (ingredient_id);

-- Many-to-many: a mix design can include multiple admixtures.
CREATE TABLE mix_design_admixtures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mix_design_id   UUID NOT NULL REFERENCES mix_designs(id) ON DELETE CASCADE,
    admixture_id    UUID NOT NULL REFERENCES admixtures(id) ON DELETE RESTRICT,
    dosage          NUMERIC(10, 4) NOT NULL,  -- amount per cubic yard
    unit            TEXT NOT NULL DEFAULT 'oz',
    UNIQUE (mix_design_id, admixture_id)
);

CREATE INDEX idx_mda_mix ON mix_design_admixtures (mix_design_id);

-- Which plants stock which mix designs
CREATE TABLE plant_mix_designs (
    plant_id        UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    mix_design_id   UUID NOT NULL REFERENCES mix_designs(id) ON DELETE CASCADE,
    PRIMARY KEY (plant_id, mix_design_id)
);

-- Recommended applications (pour types) for each mix design
CREATE TABLE mix_design_applications (
    mix_design_id   UUID NOT NULL REFERENCES mix_designs(id) ON DELETE CASCADE,
    pour_type       pour_type NOT NULL,
    PRIMARY KEY (mix_design_id, pour_type)
);

CREATE INDEX idx_mda_pour_type ON mix_design_applications (pour_type);

-- ────────────────────────────────────────────────────────────
-- TRUCKS (MASTER DATA)
-- ────────────────────────────────────────────────────────────
-- This is the identity record for a truck — VIN, model,
-- capacity, maintenance schedule. The real-time status (GPS,
-- current load, availability) lives in DynamoDB.

CREATE TABLE trucks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_number    TEXT UNIQUE NOT NULL,     -- e.g. "TRK-001"
    plant_id        UUID NOT NULL REFERENCES plants(id),
    vin             TEXT,
    make            TEXT,
    model           TEXT,
    year            INTEGER,
    type            truck_type DEFAULT 'rear_discharge',
    drum_capacity   NUMERIC(5, 1) NOT NULL,  -- cubic yards
    license_plate   TEXT,
    last_inspection DATE,
    next_inspection DATE,
    last_maintenance DATE,
    next_maintenance DATE,
    odometer        INTEGER,
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trucks_plant ON trucks (plant_id);
CREATE INDEX idx_trucks_number ON trucks (truck_number);
CREATE INDEX idx_trucks_active ON trucks (is_active) WHERE is_active = true;

-- ────────────────────────────────────────────────────────────
-- DRIVERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE drivers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id        UUID NOT NULL REFERENCES plants(id),
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    hire_date       DATE,
    license_number  TEXT,
    license_expiry  DATE,
    default_truck_id UUID REFERENCES trucks(id),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_plant ON drivers (plant_id);
CREATE INDEX idx_drivers_active ON drivers (is_active) WHERE is_active = true;

CREATE TABLE driver_certifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    certification   certification_type NOT NULL,
    issued_date     DATE,
    expiry_date     DATE,
    is_current      BOOLEAN DEFAULT true,
    UNIQUE (driver_id, certification)
);

CREATE INDEX idx_driver_certs_driver ON driver_certifications (driver_id);
CREATE INDEX idx_driver_certs_expiry ON driver_certifications (expiry_date)
    WHERE is_current = true;

-- ────────────────────────────────────────────────────────────
-- DELIVERY HISTORY
-- ────────────────────────────────────────────────────────────
-- Completed orders are archived here from DynamoDB. This is
-- the analytics goldmine — every completed delivery with full
-- foreign keys to customer, plant, truck, driver, mix design.

CREATE TABLE delivery_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number       TEXT UNIQUE NOT NULL,     -- e.g. "TKT-0042"
    dynamo_order_id     TEXT,                     -- original DynamoDB key for traceability

    -- Foreign keys to master data
    customer_id         UUID NOT NULL REFERENCES customers(id),
    plant_id            UUID NOT NULL REFERENCES plants(id),
    truck_id            UUID REFERENCES trucks(id),
    driver_id           UUID REFERENCES drivers(id),
    mix_design_id       UUID NOT NULL REFERENCES mix_designs(id),
    job_site_id         UUID REFERENCES customer_job_sites(id),

    -- Order details
    volume_yards        NUMERIC(6, 2) NOT NULL,
    slump_inches        INTEGER,
    pour_type           pour_type,
    is_hot_load         BOOLEAN DEFAULT false,
    is_will_call        BOOLEAN DEFAULT false,

    -- Timestamps
    requested_time      TIMESTAMPTZ NOT NULL,
    dispatched_at       TIMESTAMPTZ,
    arrived_at          TIMESTAMPTZ,
    pour_started_at     TIMESTAMPTZ,
    pour_completed_at   TIMESTAMPTZ,
    returned_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ NOT NULL,

    -- Computed fields (denormalized for query performance)
    cycle_time_minutes  INTEGER,                  -- total round-trip time
    travel_time_minutes INTEGER,                  -- plant to site
    pour_time_minutes   INTEGER,                  -- on-site duration
    wait_time_minutes   INTEGER,                  -- idle time at site before pour
    was_on_time         BOOLEAN,                  -- delivered within 15 min of requested

    -- Pricing
    price_per_yard      NUMERIC(10, 2),
    total_price         NUMERIC(12, 2),
    surcharges          NUMERIC(10, 2) DEFAULT 0, -- hot load, overtime, etc.

    -- Status
    final_status        order_status DEFAULT 'complete',
    cancellation_reason TEXT,
    notes               TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Primary analytics indexes
CREATE INDEX idx_dh_completed ON delivery_history (completed_at DESC);
CREATE INDEX idx_dh_plant_completed ON delivery_history (plant_id, completed_at DESC);
CREATE INDEX idx_dh_customer ON delivery_history (customer_id, completed_at DESC);
CREATE INDEX idx_dh_mix_design ON delivery_history (mix_design_id);
CREATE INDEX idx_dh_driver ON delivery_history (driver_id, completed_at DESC);
CREATE INDEX idx_dh_truck ON delivery_history (truck_id, completed_at DESC);
CREATE INDEX idx_dh_ticket ON delivery_history (ticket_number);
CREATE INDEX idx_dh_hot_load ON delivery_history (is_hot_load) WHERE is_hot_load = true;

-- ────────────────────────────────────────────────────────────
-- DELIVERY EVENTS (AUDIT TRAIL)
-- ────────────────────────────────────────────────────────────
-- When an order is archived to delivery_history, its event log
-- from DynamoDB is also copied here for permanent storage.

CREATE TABLE delivery_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_history_id UUID NOT NULL REFERENCES delivery_history(id) ON DELETE CASCADE,
    event_type          order_status NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    truck_id            UUID REFERENCES trucks(id),
    driver_id           UUID REFERENCES drivers(id),
    lat                 NUMERIC(10, 7),
    lng                 NUMERIC(10, 7),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_de_delivery ON delivery_events (delivery_history_id, occurred_at);

-- ────────────────────────────────────────────────────────────
-- PRICING RULES
-- ────────────────────────────────────────────────────────────
-- Per-customer pricing overrides and surcharge rules.

CREATE TABLE customer_pricing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    mix_design_id   UUID NOT NULL REFERENCES mix_designs(id) ON DELETE CASCADE,
    price_per_yard  NUMERIC(10, 2) NOT NULL,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date     DATE,
    UNIQUE (customer_id, mix_design_id, effective_date)
);

CREATE INDEX idx_pricing_customer ON customer_pricing (customer_id);

CREATE TABLE surcharge_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,            -- e.g. "Hot Load Surcharge"
    description     TEXT,
    amount          NUMERIC(10, 2) NOT NULL,
    is_percentage   BOOLEAN DEFAULT false,    -- flat amount or % of order total
    applies_to      TEXT,                     -- "hot_load", "overtime", "saturday", etc.
    is_active       BOOLEAN DEFAULT true
);

-- ────────────────────────────────────────────────────────────
-- VIEWS (convenience queries for common analytics)
-- ────────────────────────────────────────────────────────────

-- Daily delivery summary by plant
CREATE VIEW v_daily_plant_summary AS
SELECT
    p.id AS plant_id,
    p.name AS plant_name,
    DATE(dh.completed_at) AS delivery_date,
    COUNT(*) AS total_deliveries,
    SUM(dh.volume_yards) AS total_volume,
    ROUND(AVG(dh.cycle_time_minutes), 1) AS avg_cycle_time,
    ROUND(100.0 * SUM(CASE WHEN dh.was_on_time THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS on_time_pct,
    SUM(dh.total_price) AS total_revenue,
    COUNT(DISTINCT dh.customer_id) AS unique_customers,
    COUNT(DISTINCT dh.truck_id) AS trucks_used
FROM delivery_history dh
JOIN plants p ON dh.plant_id = p.id
WHERE dh.final_status = 'complete'
GROUP BY p.id, p.name, DATE(dh.completed_at);

-- Customer scorecard
CREATE VIEW v_customer_scorecard AS
SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    COUNT(*) AS total_orders,
    SUM(dh.volume_yards) AS total_volume,
    SUM(dh.total_price) AS total_revenue,
    ROUND(AVG(dh.cycle_time_minutes), 1) AS avg_cycle_time,
    ROUND(100.0 * SUM(CASE WHEN dh.was_on_time THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS on_time_pct,
    MAX(dh.completed_at) AS last_delivery
FROM delivery_history dh
JOIN customers c ON dh.customer_id = c.id
WHERE dh.final_status = 'complete'
GROUP BY c.id, c.name;

-- Driver performance
CREATE VIEW v_driver_performance AS
SELECT
    d.id AS driver_id,
    d.first_name || ' ' || d.last_name AS driver_name,
    p.name AS plant_name,
    COUNT(*) AS total_deliveries,
    SUM(dh.volume_yards) AS total_volume,
    ROUND(AVG(dh.cycle_time_minutes), 1) AS avg_cycle_time,
    ROUND(100.0 * SUM(CASE WHEN dh.was_on_time THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS on_time_pct,
    ROUND(AVG(dh.pour_time_minutes), 1) AS avg_pour_time
FROM delivery_history dh
JOIN drivers d ON dh.driver_id = d.id
JOIN plants p ON d.plant_id = p.id
WHERE dh.final_status = 'complete'
GROUP BY d.id, d.first_name, d.last_name, p.name;

-- ────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Compute cycle time from timestamps
CREATE OR REPLACE FUNCTION compute_cycle_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.dispatched_at IS NOT NULL AND NEW.returned_at IS NOT NULL THEN
        NEW.cycle_time_minutes := EXTRACT(EPOCH FROM (NEW.returned_at - NEW.dispatched_at)) / 60;
    END IF;

    IF NEW.dispatched_at IS NOT NULL AND NEW.arrived_at IS NOT NULL THEN
        NEW.travel_time_minutes := EXTRACT(EPOCH FROM (NEW.arrived_at - NEW.dispatched_at)) / 60;
    END IF;

    IF NEW.pour_started_at IS NOT NULL AND NEW.pour_completed_at IS NOT NULL THEN
        NEW.pour_time_minutes := EXTRACT(EPOCH FROM (NEW.pour_completed_at - NEW.pour_started_at)) / 60;
    END IF;

    IF NEW.arrived_at IS NOT NULL AND NEW.pour_started_at IS NOT NULL THEN
        NEW.wait_time_minutes := EXTRACT(EPOCH FROM (NEW.pour_started_at - NEW.arrived_at)) / 60;
    END IF;

    IF NEW.arrived_at IS NOT NULL AND NEW.requested_time IS NOT NULL THEN
        NEW.was_on_time := NEW.arrived_at <= NEW.requested_time + INTERVAL '15 minutes';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_cycle_time
    BEFORE INSERT OR UPDATE ON delivery_history
    FOR EACH ROW
    EXECUTE FUNCTION compute_cycle_time();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated  BEFORE UPDATE ON customers    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_plants_updated     BEFORE UPDATE ON plants       FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_mix_updated        BEFORE UPDATE ON mix_designs  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_trucks_updated     BEFORE UPDATE ON trucks       FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_drivers_updated    BEFORE UPDATE ON drivers      FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ────────────────────────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────────────────────────

-- Plants
INSERT INTO plants (id, name, code, address, city, state, zip, lat, lng, phone, truck_capacity, mixer_count) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Conway Batch Plant', 'PLANT-001', '1200 Industrial Loop', 'Conway', 'AR', '72032', 35.0887, -92.4421, '501-555-0100', 12, 3),
    ('a1000000-0000-0000-0000-000000000002', 'North Little Rock Plant', 'PLANT-002', '800 Concrete Way', 'North Little Rock', 'AR', '72114', 34.7834, -92.2671, '501-555-0200', 16, 4);

-- Plant operating hours (Conway: M-F 5am-5pm, Sat 6am-12pm)
INSERT INTO plant_operating_hours (plant_id, day, open_time, close_time) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'monday', '05:00', '17:00'),
    ('a1000000-0000-0000-0000-000000000001', 'tuesday', '05:00', '17:00'),
    ('a1000000-0000-0000-0000-000000000001', 'wednesday', '05:00', '17:00'),
    ('a1000000-0000-0000-0000-000000000001', 'thursday', '05:00', '17:00'),
    ('a1000000-0000-0000-0000-000000000001', 'friday', '05:00', '17:00'),
    ('a1000000-0000-0000-0000-000000000001', 'saturday', '06:00', '12:00'),
    ('a1000000-0000-0000-0000-000000000001', 'sunday', '00:00', '00:00');

-- Customers
INSERT INTO customers (id, name, account_number, billing_address, city, state, zip, phone, credit_limit, payment_terms) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Nabholz Construction', 'ACCT-001', '605 Main St', 'Conway', 'AR', '72032', '501-555-1001', 500000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000002', 'Cranford Construction', 'ACCT-002', '1400 E Oak St', 'Conway', 'AR', '72032', '501-555-1002', 250000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000003', 'Ridout Lumber', 'ACCT-003', '700 Front St', 'Conway', 'AR', '72032', '501-555-1003', 150000, 'NET15'),
    ('c1000000-0000-0000-0000-000000000004', 'Clark Contractors', 'ACCT-004', '820 Court St', 'Little Rock', 'AR', '72201', '501-555-1004', 750000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000005', 'Brasfield & Gorrie', 'ACCT-005', '3000 Cantrell Rd', 'Little Rock', 'AR', '72202', '501-555-1005', 1000000, 'NET45'),
    ('c1000000-0000-0000-0000-000000000006', 'Milestone Construction', 'ACCT-006', '200 River Market Ave', 'Little Rock', 'AR', '72201', '501-555-1006', 300000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000007', 'Perry Construction', 'ACCT-007', '115 W 3rd St', 'Morrilton', 'AR', '72110', '501-555-1007', 200000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000008', 'Flynco', 'ACCT-008', '9 Shackleford Plaza', 'Little Rock', 'AR', '72211', '501-555-1008', 400000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000009', 'Kinco Constructors', 'ACCT-009', '100 Morgan Keegan Dr', 'Little Rock', 'AR', '72202', '501-555-1009', 600000, 'NET30'),
    ('c1000000-0000-0000-0000-000000000010', 'CDI Contractors', 'ACCT-010', '400 Broadway Ave', 'North Little Rock', 'AR', '72114', '501-555-1010', 350000, 'NET30');

-- Customer contacts
INSERT INTO customer_contacts (customer_id, name, title, phone, email, is_primary) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Jim Nabholz', 'Project Manager', '501-555-2001', 'jim@nabholz.com', true),
    ('c1000000-0000-0000-0000-000000000001', 'Sarah Chen', 'Superintendent', '501-555-2002', 'schen@nabholz.com', false),
    ('c1000000-0000-0000-0000-000000000004', 'Mike Clark', 'Owner', '501-555-2004', 'mike@clarkcontractors.com', true),
    ('c1000000-0000-0000-0000-000000000005', 'David Walsh', 'VP Operations', '501-555-2005', 'dwalsh@brasfieldgorrie.com', true);

-- Customer job sites
INSERT INTO customer_job_sites (id, customer_id, name, address, city, state, zip, lat, lng, site_contact, site_phone, special_instructions) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Centennial Bank HQ Expansion', '1501 Harkrider St', 'Conway', 'AR', '72032', 35.0917, -92.4283, 'Tom Reeves', '501-555-3001', 'Enter from south gate. Hard hats required.'),
    ('b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'Conway Commons Phase II', '801 Elsinger Blvd', 'Conway', 'AR', '72032', 35.0756, -92.4602, 'Rick Cranford', '501-555-3002', 'Check in at trailer before unloading.'),
    ('b1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004', 'Hwy 65 Bridge Deck', 'Hwy 65 & Dave Ward Dr', 'Conway', 'AR', '72032', 35.0840, -92.4350, 'Bill Thompson', '501-555-3003', 'ARDOT project. Flaggers will guide trucks. No weekend pours.'),
    ('b1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005', 'Cantrell Rd Office Park', '4500 Cantrell Rd', 'Little Rock', 'AR', '72202', 34.7505, -92.3080, 'David Walsh', '501-555-3004', NULL),
    ('b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 'River Market Parking Structure', '400 President Clinton Ave', 'Little Rock', 'AR', '72201', 34.7490, -92.2710, 'Amy Rodriguez', '501-555-3005', 'Gate code: 4421');

-- Ingredients
INSERT INTO ingredients (id, name, category, unit, cost_per_unit) VALUES
    ('e1000000-0000-0000-0000-000000000001', 'Type I/II Portland Cement', 'cement', 'lbs', 0.065),
    ('e1000000-0000-0000-0000-000000000002', '#57 Limestone Aggregate', 'aggregate', 'lbs', 0.012),
    ('e1000000-0000-0000-0000-000000000003', 'Natural Sand (FM 2.7)', 'sand', 'lbs', 0.008),
    ('e1000000-0000-0000-0000-000000000004', 'Water', 'water', 'gallons', 0.004),
    ('e1000000-0000-0000-0000-000000000005', 'Class C Fly Ash', 'fly_ash', 'lbs', 0.035),
    ('e1000000-0000-0000-0000-000000000006', '#89 Pea Gravel', 'aggregate', 'lbs', 0.014),
    ('e1000000-0000-0000-0000-000000000007', 'Fiber Reinforcement (synthetic)', 'fiber', 'lbs', 1.200),
    ('e1000000-0000-0000-0000-000000000008', 'Type III Portland Cement', 'cement', 'lbs', 0.078),
    ('e1000000-0000-0000-0000-000000000009', '#67 Granite Aggregate', 'aggregate', 'lbs', 0.016),
    ('e1000000-0000-0000-0000-000000000010', 'Silica Fume', 'pozzolan', 'lbs', 0.320),
    ('e1000000-0000-0000-0000-000000000011', 'GGBFS (Slag Cement)', 'pozzolan', 'lbs', 0.045),
    ('e1000000-0000-0000-0000-000000000012', '#4 Coarse Aggregate', 'aggregate', 'lbs', 0.011),
    ('e1000000-0000-0000-0000-000000000013', 'Manufactured Sand (FM 3.0)', 'sand', 'lbs', 0.009),
    ('e1000000-0000-0000-0000-000000000014', 'Lightweight Aggregate (expanded shale)', 'aggregate', 'lbs', 0.045),
    ('e1000000-0000-0000-0000-000000000015', 'Class F Fly Ash', 'fly_ash', 'lbs', 0.032),
    ('e1000000-0000-0000-0000-000000000016', 'Steel Fiber (hooked-end)', 'fiber', 'lbs', 0.950);

-- Admixtures
INSERT INTO admixtures (id, name, type, unit, cost_per_unit) VALUES
    ('ad000000-0000-0000-0000-000000000001', 'Pozzolith 322N', 'water_reducer', 'oz', 0.12),
    ('ad000000-0000-0000-0000-000000000002', 'Micro Air', 'air_entrainer', 'oz', 0.18),
    ('ad000000-0000-0000-0000-000000000003', 'Pozzolith NC534', 'accelerator', 'oz', 0.22),
    ('ad000000-0000-0000-0000-000000000004', 'Pozz-Retard', 'retarder', 'oz', 0.15),
    ('ad000000-0000-0000-0000-000000000005', 'ADVA 140M', 'water_reducer', 'oz', 0.28),
    ('ad000000-0000-0000-0000-000000000006', 'Daratard 17', 'retarder', 'oz', 0.17),
    ('ad000000-0000-0000-0000-000000000007', 'RheoTEC Z-60', 'water_reducer', 'oz', 0.35),
    ('ad000000-0000-0000-0000-000000000008', 'Eclipse Floor', 'water_reducer', 'oz', 0.42);

-- Mix Designs
INSERT INTO mix_designs (id, code, name, psi_rating, slump_min, slump_max, description, yield_per_batch, cost_per_yard) VALUES
    ('f1000000-0000-0000-0000-000000000001', '3000PSI-STD', '3000 PSI Standard',          3000, 3, 5, 'General-purpose residential mix. Suitable for sidewalks, driveways, and light-duty slabs where high strength is not critical.', 9.0, 95.00),
    ('f1000000-0000-0000-0000-000000000002', '4000PSI-STD', '4000 PSI Standard',          4000, 3, 6, 'Workhorse commercial/residential mix. Meets code for most structural slabs, walls, and footings. Good balance of strength and workability.', 9.0, 115.00),
    ('f1000000-0000-0000-0000-000000000003', '5000PSI-HE',  '5000 PSI High-Early',        5000, 3, 5, 'High-early-strength mix using Type III cement and accelerator. Reaches 3000 PSI in 24 hours for fast form stripping on columns and structural pours.', 8.5, 145.00),
    ('f1000000-0000-0000-0000-000000000004', '4000PSI-FBR', '4000 PSI Fiber-Reinforced',  4000, 3, 5, 'Standard 4000 PSI with synthetic macro-fiber to control plastic shrinkage cracking. Ideal for large flatwork pours like parking lots and warehouse slabs.', 9.0, 135.00),
    ('f1000000-0000-0000-0000-000000000005', '3500PSI-AIR', '3500 PSI Air-Entrained',     3500, 4, 6, 'Freeze-thaw resistant mix with 5-7% entrained air. Required for all exterior flatwork in cold climates — driveways, sidewalks, patios, and exposed slabs.', 9.0, 105.00),
    ('f1000000-0000-0000-0000-000000000006', '6000PSI-HP',  '6000 PSI High-Performance',  6000, 2, 4, 'High-performance structural mix with silica fume and high-range water reducer. Designed for columns, shear walls, and transfer beams in high-rise construction.', 8.0, 185.00),
    ('f1000000-0000-0000-0000-000000000007', '4500PSI-SLG', '4500 PSI Slag Blend',        4500, 4, 7, 'Sustainable mix replacing 40% cement with slag (GGBFS). Lower heat of hydration — preferred for mass pours like mat foundations and thick grade beams.', 9.0, 120.00),
    ('f1000000-0000-0000-0000-000000000008', '3000PSI-EC',  '3000 PSI Economy',           3000, 4, 8, 'High-slump economy mix for non-structural fill, mud slabs, and lean concrete. Maximum workability at minimum cost.', 9.5, 78.00),
    ('f1000000-0000-0000-0000-000000000009', '4000PSI-PMP', '4000 PSI Pumpable',          4000, 5, 8, 'Designed for pump placement with fine aggregate ratio optimized for pumpability. Used for elevated slabs, walls, and any pour requiring a boom pump.', 9.0, 125.00),
    ('f1000000-0000-0000-0000-000000000010', '5000PSI-FBR', '5000 PSI Steel-Fiber',       5000, 3, 5, 'Heavy-duty industrial mix with hooked-end steel fibers for impact and fatigue resistance. Engineered for warehouse floors, loading docks, and heavy equipment pads.', 8.5, 175.00);

-- Mix Design Ingredients (per cubic yard)

-- 3000 PSI Standard: lower cement, more aggregate
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 470, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 1900, 'lbs'),  -- aggregate
    ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 1300, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 34, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000005', 80, 'lbs');    -- fly ash

-- 4000 PSI Standard
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 564, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 1800, 'lbs'),  -- aggregate
    ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003', 1200, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000004', 32, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000005', 100, 'lbs');   -- fly ash

-- 5000 PSI High-Early: more cement, less water, accelerator admixture
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 660, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 1750, 'lbs'),  -- aggregate
    ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 1100, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000004', 28, 'gallons'),-- water (lower w/c ratio)
    ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000005', 120, 'lbs');   -- fly ash

-- 4000 PSI Fiber-Reinforced: same as 4000 STD + pea gravel + synthetic fiber
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 564, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000006', 900, 'lbs'),   -- pea gravel (replaces some aggregate)
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000002', 900, 'lbs'),   -- aggregate
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003', 1200, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 32, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000007', 1.5, 'lbs');   -- synthetic fiber

-- 3500 PSI Air-Entrained: standard residential with air entrainment for freeze-thaw
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 510, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000002', 1850, 'lbs'),  -- limestone aggregate
    ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', 1250, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000004', 33, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 90, 'lbs');    -- fly ash

-- 6000 PSI High-Performance: silica fume + granite + low w/c ratio
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000001', 750, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000009', 1700, 'lbs'),  -- granite aggregate
    ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000013', 1050, 'lbs'),  -- manufactured sand
    ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000004', 25, 'gallons'),-- water (very low w/c)
    ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000010', 50, 'lbs');    -- silica fume

-- 4500 PSI Slag Blend: GGBFS replaces 40% of cement
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000001', 340, 'lbs'),   -- cement (reduced)
    ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000011', 225, 'lbs'),   -- slag cement (GGBFS)
    ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000002', 1800, 'lbs'),  -- limestone aggregate
    ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003', 1200, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000004', 31, 'gallons');-- water

-- 3000 PSI Economy: lean mix, high slump, max workability
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000001', 420, 'lbs'),   -- cement (low)
    ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000002', 1950, 'lbs'),  -- limestone aggregate
    ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000003', 1400, 'lbs'),  -- sand
    ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000004', 37, 'gallons'),-- water (high)
    ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000015', 100, 'lbs');   -- Class F fly ash

-- 4000 PSI Pumpable: fine sand ratio tuned for pump placement
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000001', 560, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000006', 600, 'lbs'),   -- pea gravel (improves pumpability)
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000002', 1200, 'lbs'),  -- limestone aggregate
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000003', 1350, 'lbs'),  -- sand (high ratio)
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000004', 33, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000005', 90, 'lbs');    -- fly ash

-- 5000 PSI Steel-Fiber: industrial-grade with hooked steel fibers
INSERT INTO mix_design_ingredients (mix_design_id, ingredient_id, quantity, unit) VALUES
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000001', 650, 'lbs'),   -- cement
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000009', 1750, 'lbs'),  -- granite aggregate
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000013', 1100, 'lbs'),  -- manufactured sand
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000004', 28, 'gallons'),-- water
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000005', 110, 'lbs'),   -- fly ash
    ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000016', 33, 'lbs');    -- steel fiber (~ 25 lbs/yd³)

-- Mix Design Admixtures

-- 3000 PSI Standard: water reducer only
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 2.5, 'oz');    -- water reducer

-- 4000 PSI Standard: water reducer + air entrainer
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000001', 3.0, 'oz'),    -- water reducer
    ('f1000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000002', 1.0, 'oz');    -- air entrainer

-- 5000 PSI High-Early: water reducer + accelerator (high-early strength)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 4.0, 'oz'),    -- water reducer (higher dose)
    ('f1000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000003', 6.0, 'oz');    -- accelerator

-- 4000 PSI Fiber-Reinforced: water reducer + air entrainer + retarder (fiber needs workability time)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000001', 3.5, 'oz'),    -- water reducer
    ('f1000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000002', 1.0, 'oz'),    -- air entrainer
    ('f1000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000004', 2.0, 'oz');    -- retarder

-- 3500 PSI Air-Entrained: water reducer + air entrainer (freeze-thaw critical)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000005', 'ad000000-0000-0000-0000-000000000001', 3.0, 'oz'),    -- water reducer
    ('f1000000-0000-0000-0000-000000000005', 'ad000000-0000-0000-0000-000000000002', 1.5, 'oz');    -- air entrainer (higher dose for 6% target)

-- 6000 PSI High-Performance: high-range water reducer (superplasticizer) for low w/c
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000006', 'ad000000-0000-0000-0000-000000000005', 8.0, 'oz'),    -- ADVA 140M (high-range WR)
    ('f1000000-0000-0000-0000-000000000006', 'ad000000-0000-0000-0000-000000000006', 3.0, 'oz');    -- retarder (extended working time for tall pours)

-- 4500 PSI Slag Blend: water reducer + retarder (slag sets slowly, retarder for hot weather)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000007', 'ad000000-0000-0000-0000-000000000001', 3.0, 'oz'),    -- water reducer
    ('f1000000-0000-0000-0000-000000000007', 'ad000000-0000-0000-0000-000000000006', 2.0, 'oz');    -- retarder

-- 3000 PSI Economy: water reducer only (keep it simple and cheap)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000008', 'ad000000-0000-0000-0000-000000000001', 2.0, 'oz');    -- water reducer (low dose)

-- 4000 PSI Pumpable: high-range WR + retarder (workability window for pump setup)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000009', 'ad000000-0000-0000-0000-000000000005', 5.0, 'oz'),    -- ADVA 140M (flowability)
    ('f1000000-0000-0000-0000-000000000009', 'ad000000-0000-0000-0000-000000000006', 2.5, 'oz'),    -- retarder
    ('f1000000-0000-0000-0000-000000000009', 'ad000000-0000-0000-0000-000000000007', 4.0, 'oz');    -- RheoTEC (viscosity modifier for pumpability)

-- 5000 PSI Steel-Fiber: high-range WR + air entrainer + retarder (steel fiber reduces workability)
INSERT INTO mix_design_admixtures (mix_design_id, admixture_id, dosage, unit) VALUES
    ('f1000000-0000-0000-0000-000000000010', 'ad000000-0000-0000-0000-000000000005', 6.0, 'oz'),    -- ADVA 140M
    ('f1000000-0000-0000-0000-000000000010', 'ad000000-0000-0000-0000-000000000002', 0.8, 'oz'),    -- air entrainer
    ('f1000000-0000-0000-0000-000000000010', 'ad000000-0000-0000-0000-000000000004', 2.5, 'oz');    -- retarder (extended working time)

-- Plant mix design availability
-- Riverside (Plant 1): full-service plant, stocks all 10 mixes
INSERT INTO plant_mix_designs (plant_id, mix_design_id) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009'),
    ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010'),
    -- Northside (Plant 2): residential-focused, stocks 7 mixes (no HP, no steel-fiber, no pumpable)
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000005'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000007'),
    ('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000008');

-- Mix design recommended applications
INSERT INTO mix_design_applications (mix_design_id, pour_type) VALUES
    -- 3000 PSI Standard: lighter residential flatwork
    ('f1000000-0000-0000-0000-000000000001', 'driveway'),
    ('f1000000-0000-0000-0000-000000000001', 'sidewalk'),
    ('f1000000-0000-0000-0000-000000000001', 'slab'),
    -- 4000 PSI Standard: general commercial/residential structural
    ('f1000000-0000-0000-0000-000000000002', 'driveway'),
    ('f1000000-0000-0000-0000-000000000002', 'slab'),
    ('f1000000-0000-0000-0000-000000000002', 'wall'),
    ('f1000000-0000-0000-0000-000000000002', 'footing'),
    ('f1000000-0000-0000-0000-000000000002', 'foundation'),
    -- 5000 PSI High-Early: structural, fast form stripping
    ('f1000000-0000-0000-0000-000000000003', 'foundation'),
    ('f1000000-0000-0000-0000-000000000003', 'column'),
    ('f1000000-0000-0000-0000-000000000003', 'grade_beam'),
    ('f1000000-0000-0000-0000-000000000003', 'footing'),
    ('f1000000-0000-0000-0000-000000000003', 'wall'),
    -- 4000 PSI Fiber-Reinforced: crack-resistant flatwork and parking
    ('f1000000-0000-0000-0000-000000000004', 'driveway'),
    ('f1000000-0000-0000-0000-000000000004', 'sidewalk'),
    ('f1000000-0000-0000-0000-000000000004', 'slab'),
    -- 3500 PSI Air-Entrained: exterior work in freeze-thaw climates
    ('f1000000-0000-0000-0000-000000000005', 'driveway'),
    ('f1000000-0000-0000-0000-000000000005', 'sidewalk'),
    ('f1000000-0000-0000-0000-000000000005', 'slab'),
    -- 6000 PSI High-Performance: high-rise structural elements
    ('f1000000-0000-0000-0000-000000000006', 'column'),
    ('f1000000-0000-0000-0000-000000000006', 'wall'),
    ('f1000000-0000-0000-0000-000000000006', 'foundation'),
    ('f1000000-0000-0000-0000-000000000006', 'grade_beam'),
    -- 4500 PSI Slag Blend: mass pours, sustainable option
    ('f1000000-0000-0000-0000-000000000007', 'foundation'),
    ('f1000000-0000-0000-0000-000000000007', 'grade_beam'),
    ('f1000000-0000-0000-0000-000000000007', 'footing'),
    ('f1000000-0000-0000-0000-000000000007', 'slab'),
    -- 3000 PSI Economy: fill and non-structural
    ('f1000000-0000-0000-0000-000000000008', 'slab'),
    ('f1000000-0000-0000-0000-000000000008', 'footing'),
    -- 4000 PSI Pumpable: elevated pours, boom pump placement
    ('f1000000-0000-0000-0000-000000000009', 'slab'),
    ('f1000000-0000-0000-0000-000000000009', 'wall'),
    ('f1000000-0000-0000-0000-000000000009', 'column'),
    ('f1000000-0000-0000-0000-000000000009', 'foundation'),
    -- 5000 PSI Steel-Fiber: industrial floors and heavy-duty pads
    ('f1000000-0000-0000-0000-000000000010', 'slab'),
    ('f1000000-0000-0000-0000-000000000010', 'foundation');

-- Trucks (master data)
INSERT INTO trucks (id, truck_number, plant_id, make, model, year, type, drum_capacity, is_active) VALUES
    ('ae000000-0000-0000-0000-000000000001', 'TRK-001', 'a1000000-0000-0000-0000-000000000001', 'Peterbilt', '520', 2022, 'rear_discharge', 12.0, true),
    ('ae000000-0000-0000-0000-000000000002', 'TRK-002', 'a1000000-0000-0000-0000-000000000001', 'Kenworth', 'T880', 2021, 'rear_discharge', 10.0, true),
    ('ae000000-0000-0000-0000-000000000003', 'TRK-003', 'a1000000-0000-0000-0000-000000000001', 'Mack', 'Granite', 2023, 'rear_discharge', 12.0, true),
    ('ae000000-0000-0000-0000-000000000004', 'TRK-004', 'a1000000-0000-0000-0000-000000000001', 'Peterbilt', '520', 2020, 'front_discharge', 10.0, true),
    ('ae000000-0000-0000-0000-000000000005', 'TRK-005', 'a1000000-0000-0000-0000-000000000001', 'Kenworth', 'T880', 2022, 'rear_discharge', 12.0, true),
    ('ae000000-0000-0000-0000-000000000006', 'TRK-006', 'a1000000-0000-0000-0000-000000000002', 'Mack', 'Granite', 2021, 'rear_discharge', 12.0, true),
    ('ae000000-0000-0000-0000-000000000007', 'TRK-007', 'a1000000-0000-0000-0000-000000000002', 'Peterbilt', '567', 2023, 'rear_discharge', 10.0, true),
    ('ae000000-0000-0000-0000-000000000008', 'TRK-008', 'a1000000-0000-0000-0000-000000000002', 'Kenworth', 'T880', 2022, 'front_discharge', 12.0, true);

-- Drivers
INSERT INTO drivers (id, plant_id, first_name, last_name, phone, hire_date, default_truck_id) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Marcus', 'Johnson', '501-555-4001', '2019-03-15', 'ae000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Daryl', 'Webb', '501-555-4002', '2020-06-01', 'ae000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Chris', 'Ramirez', '501-555-4003', '2018-11-20', 'ae000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Tommy', 'Nguyen', '501-555-4004', '2021-01-10', 'ae000000-0000-0000-0000-000000000004'),
    ('d0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Jake', 'Patterson', '501-555-4005', '2022-04-18', 'ae000000-0000-0000-0000-000000000005'),
    ('d0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'Luis', 'Hernandez', '501-555-4006', '2019-08-05', 'ae000000-0000-0000-0000-000000000006'),
    ('d0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'DeShawn', 'Carter', '501-555-4007', '2020-02-14', 'ae000000-0000-0000-0000-000000000007'),
    ('d0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'Bobby', 'Mitchell', '501-555-4008', '2021-09-22', 'ae000000-0000-0000-0000-000000000008');

-- Driver certifications
INSERT INTO driver_certifications (driver_id, certification, issued_date, expiry_date) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'cdl_class_b', '2019-03-01', '2027-03-01'),
    ('d0000000-0000-0000-0000-000000000001', 'osha_10', '2023-06-15', '2028-06-15'),
    ('d0000000-0000-0000-0000-000000000002', 'cdl_class_b', '2020-05-20', '2028-05-20'),
    ('d0000000-0000-0000-0000-000000000003', 'cdl_class_a', '2018-10-01', '2026-10-01'),
    ('d0000000-0000-0000-0000-000000000003', 'hazmat', '2022-01-10', '2027-01-10'),
    ('d0000000-0000-0000-0000-000000000003', 'osha_30', '2023-03-20', '2028-03-20');

-- Surcharge rules
INSERT INTO surcharge_rules (name, description, amount, is_percentage, applies_to) VALUES
    ('Hot Load Surcharge', 'Additional charge for unscheduled urgent deliveries', 75.00, false, 'hot_load'),
    ('Saturday Delivery', 'Weekend delivery surcharge', 50.00, false, 'saturday'),
    ('Overtime Surcharge', 'Orders placed after 3 PM for same-day delivery', 15.00, true, 'overtime'),
    ('Short Load Fee', 'Orders under 3 cubic yards', 45.00, false, 'short_load');

-- Sample delivery history (30 days back + ~2.5 weeks forward through April 24)
-- Generates realistic historical + near-future data for analytics.
-- In production, this table is populated by the order completion flow.
-- ~330 records: 55 days * 6 deliveries/day = 330

INSERT INTO delivery_history (
    ticket_number, customer_id, plant_id, truck_id, driver_id, mix_design_id, job_site_id,
    volume_yards, slump_inches, pour_type, is_hot_load,
    requested_time, dispatched_at, arrived_at, pour_started_at, pour_completed_at, returned_at, completed_at,
    price_per_yard, total_price
)
SELECT
    'TKT-H' || LPAD(row_number() OVER()::TEXT, 4, '0'),
    customer_ids[1 + (i % 10)],
    plant_ids[1 + (i % 2)],
    truck_ids[1 + (i % 8)],
    driver_ids[1 + (i % 8)],
    mix_ids[1 + (i % 4)],
    CASE WHEN i % 5 < 5 THEN job_site_ids[1 + (i % 5)] ELSE NULL END,
    volumes[1 + (i % 5)],
    slumps[1 + (i % 4)],
    pour_types[1 + (i % 6)],
    i % 12 = 0,   -- every 12th order is a hot load
    base_date + (i / 6) * INTERVAL '1 day' + (5 + (i % 8)) * INTERVAL '1 hour',     -- requested
    base_date + (i / 6) * INTERVAL '1 day' + (4.5 + (i % 8)) * INTERVAL '1 hour',   -- dispatched (30 min before)
    base_date + (i / 6) * INTERVAL '1 day' + (5.3 + (i % 8)) * INTERVAL '1 hour',   -- arrived
    base_date + (i / 6) * INTERVAL '1 day' + (5.5 + (i % 8)) * INTERVAL '1 hour',   -- pour started
    base_date + (i / 6) * INTERVAL '1 day' + (6.0 + (i % 8)) * INTERVAL '1 hour',   -- pour completed
    base_date + (i / 6) * INTERVAL '1 day' + (6.5 + (i % 8)) * INTERVAL '1 hour',   -- returned
    base_date + (i / 6) * INTERVAL '1 day' + (6.5 + (i % 8)) * INTERVAL '1 hour',   -- completed
    prices[1 + (i % 4)],
    volumes[1 + (i % 5)] * prices[1 + (i % 4)]
FROM generate_series(0, 329) AS s(i),
LATERAL (SELECT
    NOW() - INTERVAL '30 days' AS base_date,
    ARRAY['c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000005','c1000000-0000-0000-0000-000000000006','c1000000-0000-0000-0000-000000000007','c1000000-0000-0000-0000-000000000008','c1000000-0000-0000-0000-000000000009','c1000000-0000-0000-0000-000000000010']::UUID[] AS customer_ids,
    ARRAY['a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002']::UUID[] AS plant_ids,
    ARRAY['ae000000-0000-0000-0000-000000000001','ae000000-0000-0000-0000-000000000002','ae000000-0000-0000-0000-000000000003','ae000000-0000-0000-0000-000000000004','ae000000-0000-0000-0000-000000000005','ae000000-0000-0000-0000-000000000006','ae000000-0000-0000-0000-000000000007','ae000000-0000-0000-0000-000000000008']::UUID[] AS truck_ids,
    ARRAY['d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000008']::UUID[] AS driver_ids,
    ARRAY['f1000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000004']::UUID[] AS mix_ids,
    ARRAY['b1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000005']::UUID[] AS job_site_ids,
    ARRAY[4.0, 6.0, 8.0, 10.0, 12.0]::NUMERIC[] AS volumes,
    ARRAY[4, 5, 6, 8]::INTEGER[] AS slumps,
    ARRAY['foundation', 'slab', 'wall', 'driveway', 'sidewalk', 'column']::pour_type[] AS pour_types,
    ARRAY[95.00, 115.00, 145.00, 135.00]::NUMERIC[] AS prices
) AS vals;