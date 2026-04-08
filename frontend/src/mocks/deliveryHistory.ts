/**
 * deliveryHistory — weekly fleet utilization summary per plant.
 *
 * Used to compute the utilization donut chart.
 * "Productive hours" = time trucks spent loading, in-transit, or pouring.
 * "Idle hours" = time trucks were available but not dispatched.
 * "Maintenance hours" = time trucks were down for service.
 *
 * Source: aggregated from completed delivery_events in Aurora (Phase 5+).
 * For Phase 3, this is synthetic data sized to look realistic for a 5-truck
 * plant running 8am–5pm, 5 days a week.
 */

import type { UtilizationData } from './types';

/** Current week utilization by plant. */
export const utilizationByPlant: Record<string, UtilizationData> = {
  'PLANT-001': {
    // 5 trucks × ~5.5 productive hrs/day × 5 days
    productiveHours: 137,
    // 5 trucks × ~1.5 idle hrs/day × 5 days (batching delays, will-calls)
    idleHours: 38,
    // 1 truck in maintenance (TRUCK-105) × 40hrs
    maintenanceHours: 25,
  },
  'PLANT-002': {
    // 3 trucks × ~5 productive hrs/day × 5 days
    productiveHours: 75,
    idleHours: 22,
    maintenanceHours: 3,
  },
};

/** Total fleet hours across both plants (for a summary view). */
export const totalUtilization: UtilizationData = {
  productiveHours:  212,
  idleHours:         60,
  maintenanceHours:  28,
};

/** Derived: utilization % = productive / (productive + idle + maintenance) */
export function utilizationPercent(data: UtilizationData): number {
  const total = data.productiveHours + data.idleHours + data.maintenanceHours;
  if (total === 0) return 0;
  return Math.round((data.productiveHours / total) * 100);
}
