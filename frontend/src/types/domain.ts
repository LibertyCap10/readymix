import type { OrderStatus, TruckStatus } from '../theme/statusColors';

// ─── Plants ──────────────────────────────────────────────
export interface Plant {
  plantId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  latitude: number;
  longitude: number;
}

// ─── Customers ───────────────────────────────────────────
export interface CustomerContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface JobSite {
  siteId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  gateCode?: string;
  siteContact: string;
  siteContactPhone: string;
}

export interface Customer {
  customerId: string;
  name: string;
  accountNumber: string;
  contacts: CustomerContact[];
  jobSites: JobSite[];
}

// ─── Mix Designs ─────────────────────────────────────────
export interface Ingredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

export type AdmixtureType = 'accelerator' | 'retarder' | 'air_entrainer' | 'water_reducer';

export interface Admixture {
  admixtureId: string;
  name: string;
  type: AdmixtureType;
  dosage: number;
  unit: string;
}

export interface MixDesign {
  mixDesignId: string;
  code: string;
  name: string;
  psi: number;
  slumpMin: number;
  slumpMax: number;
  description?: string;
  yieldPerBatch?: number;
  costPerYard?: number;
  isActive: boolean;
  applications: PourType[];
  ingredients: Ingredient[];
  admixtures: Admixture[];
}

export interface IngredientOption {
  ingredientId: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit?: number;
}

export interface AdmixtureOption {
  admixtureId: string;
  name: string;
  type: AdmixtureType;
  unit: string;
  costPerUnit?: number;
}

export interface MixDesignDraft {
  code: string;
  name: string;
  psi: number | '';
  slumpMin: number | '';
  slumpMax: number | '';
  description: string;
  yieldPerBatch: number | '';
  costPerYard: number | '';
  applications: PourType[];
  ingredients: { ingredientId: string; quantity: number | ''; unit: string }[];
  admixtures: { admixtureId: string; dosage: number | ''; unit: string }[];
  plantId?: string;
}

export interface MixDesignFilters {
  psiMin?: number;
  psiMax?: number;
  pourType?: PourType;
  includeInactive: boolean;
}

// ─── Trucks & Drivers ────────────────────────────────────
export interface Driver {
  driverId: string;
  name: string;
  phone: string;
  certifications: string[];
}

export interface Truck {
  truckId: string;
  truckNumber: string;
  plantId: string;
  type: 'rear_discharge' | 'front_discharge' | 'volumetric';
  capacity: number;        // cubic yards
  year: number;
  make: string;
  model: string;
  vin: string;
  driver: Driver;
  currentStatus: TruckStatus;
  currentJobSite?: string;
  currentOrderId?: string;
  lastWashout: string;     // ISO datetime
  loadsToday: number;
  latitude?: number;
  longitude?: number;
}

// ─── Orders ──────────────────────────────────────────────
export type PourType =
  | 'foundation'
  | 'slab'
  | 'wall'
  | 'driveway'
  | 'sidewalk'
  | 'column'
  | 'footing'
  | 'grade_beam';

export const POUR_TYPE_LABELS: Record<PourType, string> = {
  foundation: 'Foundation',
  slab: 'Slab',
  wall: 'Wall',
  driveway: 'Driveway',
  sidewalk: 'Sidewalk',
  column: 'Column',
  footing: 'Footing',
  grade_beam: 'Grade Beam',
};

export interface DeliveryEvent {
  timestamp: string;       // ISO datetime
  eventType: OrderStatus;
  note?: string;
  userId?: string;
}

// ─── Order Timeline (computed at dispatch time) ─────────────
export interface OrderTimeline {
  scheduledDepartureAt: string;   // ISO — when truck leaves plant
  loadingCompletesAt: string;     // ISO — departure + loading duration
  transitArrivalAt: string;       // ISO — loading complete + drive time
  pourCompletesAt: string;        // ISO — arrival + pour duration
  returnDepartureAt: string;      // ISO — same as pourCompletesAt
  returnArrivalAt: string;        // ISO — return departure + drive time
}

// ─── Route Data (Mapbox snapshot stored at dispatch) ────────
export interface OrderRouteData {
  coordinates: [number, number][];   // [[lng, lat], ...] from Mapbox
  distanceMeters: number;            // total route distance
  durationSeconds: number;           // Mapbox drive time estimate
}

// ─── Cancellation (populated on cancel) ─────────────────────
export interface OrderCancellation {
  cancelledAt: string;               // ISO — when cancelled
  positionAtCancel?: [number, number]; // [lng, lat] where truck was
  estimatedReturnAt?: string;        // ISO — when truck returns to plant
  returnCoordinates?: [number, number][]; // route back to plant
  truckReturned?: boolean;           // set by ticker when truck is back at plant
}

export interface Order {
  ticketNumber: string;
  plantId: string;
  customerId: string;
  customerName: string;
  jobSiteId: string;
  jobSiteName: string;
  jobSiteAddress: string;
  jobSiteLatitude?: number;
  jobSiteLongitude?: number;
  mixDesignId: string;
  mixDesignName: string;
  psi: number;
  volume: number;          // cubic yards
  slump: number;           // inches
  pourType: PourType;
  requestedTime: string;   // ISO datetime
  assignedTruckId?: string;
  assignedTruckNumber?: string;
  driverName?: string;
  status: OrderStatus;
  isHotLoad: boolean;
  notes?: string;
  events: DeliveryEvent[];
  createdAt: string;       // ISO datetime
  updatedAt: string;       // ISO datetime

  // Server-driven lifecycle fields (populated at dispatch)
  timeline?: OrderTimeline;
  routeData?: OrderRouteData;
  cancellation?: OrderCancellation;
}

// ─── Analytics ───────────────────────────────────────────
export interface DailyVolume {
  date: string;
  totalVolume: number;
  orderCount: number;
}

export interface CycleTimePoint {
  date: string;
  avgMinutes: number;
}

export interface UtilizationData {
  productiveHours: number;
  idleHours: number;
  maintenanceHours: number;
}
