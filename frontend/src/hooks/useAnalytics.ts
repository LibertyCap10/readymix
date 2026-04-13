/**
 * useAnalytics — data hook for the Fleet View analytics charts.
 *
 * Phase 6: fetches from real API endpoints. Interface unchanged.
 */

import { useState, useMemo, useEffect } from 'react';
import { usePlant } from '@/context/PlantContext';
import { api } from '@/api/client';
import type { UtilizationData } from '@/types/domain';

function formatChartDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface CycleTimeChartPoint {
  label: string;       // "Mar 25"
  avgMinutes: number;
}

export interface UtilizationSegment {
  category: string;    // "Productive", "Idle", "Maintenance"
  hours: number;
  color: string;
}

export interface UseAnalyticsReturn {
  cycleTimePoints: CycleTimeChartPoint[];
  utilization: UtilizationData;
  utilizationPct: number;
  utilizationSegments: UtilizationSegment[];
  loading: boolean;
  error: string | null;
}

interface CycleTimeApiResponse {
  plantId: string;
  range: string;
  data: Array<{ date: string; avgMinutes: number }>;
  benchmarkMinutes: number;
}

interface UtilizationApiResponse {
  plantId: string;
  total: number;
  productiveCount: number;
  utilizationPct: number;
  byStatus: Record<string, number>;
}

export function useAnalytics(): UseAnalyticsReturn {
  const { selectedPlant } = usePlant();
  const [cycleTimeRaw, setCycleTimeRaw] = useState<Array<{ date: string; avgMinutes: number }>>([]);
  const [utilResponse, setUtilResponse] = useState<UtilizationApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<CycleTimeApiResponse>('/analytics/cycle-times', {
        plantId: selectedPlant.plantId,
        range: '7d',
      }),
      api.get<UtilizationApiResponse>('/analytics/utilization', {
        plantId: selectedPlant.plantId,
      }),
    ])
      .then(([cycleData, utilData]) => {
        if (!cancelled) {
          setCycleTimeRaw(cycleData.data);
          setUtilResponse(utilData);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedPlant.plantId]);

  const cycleTimePoints = useMemo<CycleTimeChartPoint[]>(
    () => cycleTimeRaw.map((p) => ({
      label: formatChartDate(p.date),
      avgMinutes: p.avgMinutes,
    })),
    [cycleTimeRaw]
  );

  // Map API utilization response to the UtilizationData shape.
  // The API returns counts; we derive "hours" proportionally for the donut chart.
  const utilization = useMemo<UtilizationData>(() => {
    if (!utilResponse) return { productiveHours: 0, idleHours: 0, maintenanceHours: 0 };
    const { total, productiveCount } = utilResponse;
    const idle = total - productiveCount;
    // Scale to a 10-hour workday for the chart segments
    const productiveHours = total > 0 ? Math.round((productiveCount / total) * 10 * 10) / 10 : 0;
    const idleHours = total > 0 ? Math.round((idle / total) * 10 * 10) / 10 : 0;
    return { productiveHours, idleHours, maintenanceHours: 0 };
  }, [utilResponse]);

  const utilizationPct = utilResponse?.utilizationPct ?? 0;

  const utilizationSegments = useMemo<UtilizationSegment[]>(
    () => [
      { category: 'Productive', hours: utilization.productiveHours, color: '#37474F' },
      { category: 'Idle',       hours: utilization.idleHours,       color: '#FF6D00' },
      { category: 'Maintenance',hours: utilization.maintenanceHours, color: '#C62828' },
    ],
    [utilization]
  );

  return {
    cycleTimePoints,
    utilization,
    utilizationPct,
    utilizationSegments,
    loading,
    error,
  };
}
