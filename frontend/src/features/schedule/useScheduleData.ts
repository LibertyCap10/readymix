/**
 * useScheduleData — fetches the daily schedule for the Gantt view.
 *
 * Polls GET /schedule?plantId=X&date=Y every 15 seconds,
 * matching the polling cadence of useOrders.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlant } from '@/context/PlantContext';
import { api } from '@/api/client';
import type { ScheduleResponse } from '@/types/domain';

const POLL_INTERVAL_MS = 15_000;

export interface UseScheduleDataReturn {
  data: ScheduleResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useScheduleData(date: string): UseScheduleDataReturn {
  const { selectedPlant } = usePlant();
  const plantId = selectedPlant.plantId;
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!plantId || !date) return;
    try {
      const result = await api.get<ScheduleResponse>('/schedule', { plantId, date });
      setData(result);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to fetch schedule';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [plantId, date]);

  useEffect(() => {
    setLoading(true);
    fetchSchedule();
    const interval = setInterval(fetchSchedule, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSchedule]);

  return { data, loading, error, refetch: fetchSchedule };
}
