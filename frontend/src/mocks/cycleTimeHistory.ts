/**
 * cycleTimeHistory — 7-day rolling average cycle times per plant.
 *
 * "Cycle time" = total minutes from plant departure to return after washout.
 * Industry benchmark for Austin-area short hauls: ~90–120 min.
 * Longer days have higher averages (more traffic, longer pours).
 */

import type { CycleTimePoint } from './types';

/** Last 7 days ending 2026-03-31. */
export const cycleTimeHistory: CycleTimePoint[] = [
  { date: '2026-03-25', avgMinutes: 88 },
  { date: '2026-03-26', avgMinutes: 95 },
  { date: '2026-03-27', avgMinutes: 102 },
  { date: '2026-03-28', avgMinutes: 97 },
  { date: '2026-03-29', avgMinutes: 91 },   // Saturday — lighter traffic
  { date: '2026-03-30', avgMinutes: 78 },   // Sunday — few deliveries
  { date: '2026-03-31', avgMinutes: 104 },  // Today — busy Monday
];

/** Format a YYYY-MM-DD string to "Mar 25" for chart axis labels. */
export function formatChartDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00'); // noon to avoid timezone edge
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
