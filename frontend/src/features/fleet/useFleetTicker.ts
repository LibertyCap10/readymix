/**
 * useFleetTicker — polls fleet status from the API.
 *
 * Phase 6: replaces the simulation with real API polling.
 * Every `intervalMs` (default 10s), fetches GET /fleet?plantId for
 * updated truck statuses. Maintains the same countdown timer for UI.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/api/client';
import type { TruckStatus } from '@/theme/statusColors';

export type TruckStatusMap = Record<string, TruckStatus>;

interface FleetTruck {
  truckId: string;
  truckNumber?: string;
  plantId: string;
  type?: string;
  capacity?: number;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  driverName?: string;
  driverId?: string;
  currentStatus: TruckStatus;
  currentOrderId?: string | null;
  currentJobSite?: string | null;
  lastUpdated?: string;
  loadsToday?: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface UseFleetTickerOptions {
  plantId: string;
  intervalMs?: number;
}

interface UseFleetTickerReturn {
  statuses: TruckStatusMap;
  trucks: FleetTruck[];
  secondsUntilNext: number;
  loading: boolean;
  error: string | null;
}

export function useFleetTicker({
  plantId,
  intervalMs = 10_000,
}: UseFleetTickerOptions): UseFleetTickerReturn {
  const [trucks, setTrucks] = useState<FleetTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsUntilNext, setSecondsUntilNext] = useState(intervalMs / 1000);
  const mountedRef = useRef(true);

  const fetchFleet = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await api.get<{ trucks: FleetTruck[]; count: number }>('/fleet', { plantId });
      if (mountedRef.current) {
        setTrucks(data.trucks);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const apiErr = err as { message?: string };
        setError(apiErr.message ?? 'Failed to load fleet');
      }
    } finally {
      if (mountedRef.current && isInitial) setLoading(false);
    }
  }, [plantId]);

  // Initial fetch + refetch on plant change
  useEffect(() => {
    mountedRef.current = true;
    fetchFleet(true);
    return () => { mountedRef.current = false; };
  }, [fetchFleet]);

  // Polling interval
  useEffect(() => {
    const id = setInterval(() => fetchFleet(false), intervalMs);
    return () => clearInterval(id);
  }, [fetchFleet, intervalMs]);

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

  // Build status map from truck data
  const statuses: TruckStatusMap = {};
  for (const t of trucks) {
    statuses[t.truckId] = t.currentStatus;
  }

  return { statuses, trucks, secondsUntilNext, loading, error };
}
