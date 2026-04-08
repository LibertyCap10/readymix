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
  name: string;
  quantity: number;
  unit: string;
}

export interface Admixture {
  name: string;
  type: 'accelerator' | 'retarder' | 'air_entrainer' | 'water_reducer';
  dosage: number;
  unit: string;
}

export interface MixDesign {
  mixDesignId: string;
  name: string;
  psi: number;
  aggregateType: string;
  slumpMin: number;
  slumpMax: number;
  ingredients: Ingredient[];
  admixtures: Admixture[];
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

export interface DeliveryEvent {
  timestamp: string;       // ISO datetime
  eventType: OrderStatus;
  note?: string;
  userId?: string;
}

export interface Order {
  ticketNumber: string;
  plantId: string;
  customerId: string;
  customerName: string;
  jobSiteId: string;
  jobSiteName: string;
  jobSiteAddress: string;
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
