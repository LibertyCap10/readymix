export type SimulationPhase =
  | 'loading'
  | 'in_transit_outbound'
  | 'pouring'
  | 'in_transit_return'
  | 'complete';

export interface SimulationEntry {
  ticketNumber: string;
  truckId: string;
  phase: SimulationPhase;
  phaseStartedAt: number;          // Date.now() when phase began
  phaseDuration: number;           // ms for this phase
  routeCoordinates: [number, number][];
  cumulativeDistances: number[];
  totalRouteDistance: number;       // meters
  routeDurationMs: number;         // travel time in ms (from Mapbox)
  currentPosition: { lng: number; lat: number };
  jobSitePosition: { lng: number; lat: number };
  volume: number;                  // cubic yards, for pour duration calc
  transitioning: boolean;          // true while awaiting API status update
}

export interface SimulationConfig {
  loadingDurationMs: number;
  pourRateMsPerYard: number;
  minPourDurationMs: number;
  tickIntervalMs: number;
  speedMultiplier: number;
}

export interface SimulationOutput {
  truckPositions: Map<string, { lng: number; lat: number }>;
  truckStatuses: Map<string, string>;
  activeEntries: SimulationEntry[];
}
