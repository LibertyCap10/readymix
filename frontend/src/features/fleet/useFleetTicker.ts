/**
 * useFleetTicker — simulates live truck status changes.
 *
 * Every `intervalMs` (default 10s), one non-maintenance truck advances to
 * the next stage in the dispatch cycle:
 *
 *   available → loading → in_transit → pouring → returning → available
 *
 * This mimics real-world dispatch: at any moment one truck is finishing one
 * stage and moving to the next. Maintenance trucks never change — they're
 * down for service.
 *
 * Phase 6: this hook is replaced by polling GET /fleet/status?plantId every
 * 10 seconds. The consumer (useFleet) stays identical.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TruckStatus } from '@/theme/statusColors';

// The natural progression of a truck through its workday
const NEXT_STATUS: Record<TruckStatus, TruckStatus> = {
  available:   'loading',
  loading:     'in_transit',
  in_transit:  'pouring',
  pouring:     'returning',
  returning:   'available',
  maintenance: 'maintenance', // stays put
};

export type TruckStatusMap = Record<string, TruckStatus>;

interface UseFleetTickerOptions {
  initialStatuses: TruckStatusMap;
  plantTruckIds: string[];  // only tick trucks belonging to the selected plant
  intervalMs?: number;
}

interface UseFleetTickerReturn {
  statuses: TruckStatusMap;
  secondsUntilNext: number; // countdown for "Next update in Xs" UI
}

export function useFleetTicker({
  initialStatuses,
  plantTruckIds,
  intervalMs = 10_000,
}: UseFleetTickerOptions): UseFleetTickerReturn {
  const [statuses, setStatuses] = useState<TruckStatusMap>(initialStatuses);
  const [secondsUntilNext, setSecondsUntilNext] = useState(intervalMs / 1000);

  // Keep a stable ref to the current statuses for use inside setInterval
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  // Reset statuses when initialStatuses changes (plant switch)
  useEffect(() => {
    setStatuses(initialStatuses);
  }, [initialStatuses]);

  const tick = useCallback(() => {
    const activeTruckIds = plantTruckIds.filter(
      (id) => statusesRef.current[id] !== 'maintenance'
    );
    if (!activeTruckIds.length) return;

    // Pick one truck deterministically based on current second (not truly random
    // so tests are reproducible) — in real code this would be the server response.
    const idx = Math.floor(Date.now() / 1000) % activeTruckIds.length;
    const truckId = activeTruckIds[idx];
    const current = statusesRef.current[truckId];

    setStatuses((prev) => ({
      ...prev,
      [truckId]: NEXT_STATUS[current],
    }));
  }, [plantTruckIds]);

  // Main status-update interval
  useEffect(() => {
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [tick, intervalMs]);

  // Countdown timer (updates every second)
  useEffect(() => {
    setSecondsUntilNext(intervalMs / 1000);
    const countdownId = setInterval(() => {
      setSecondsUntilNext((s) => {
        if (s <= 1) return intervalMs / 1000;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdownId);
  }, [intervalMs]);

  return { statuses, secondsUntilNext };
}
