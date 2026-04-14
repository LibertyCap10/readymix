import type { SimulationConfig } from './types';

export const DEFAULT_CONFIG: SimulationConfig = {
  loadingDurationMs: 7 * 60 * 1000,      // 7 minutes at plant
  pourRateMsPerYard: 10 * 60 * 1000,     // 10 minutes per cubic yard
  minPourDurationMs: 5 * 60 * 1000,      // 5 minute floor
  tickIntervalMs: 1000,                   // 1 second ticks
  speedMultiplier: 1,                     // 1x real-time (increase for demos)
};
