/**
 * useAnalytics — data hook for the Analytics charts.
 *
 * Phase 3: returns mock cycle-time and utilization data.
 * Phase 6: swaps to GET /analytics/* endpoints. Interface unchanged.
 */

import { useMemo } from 'react';
import { usePlant } from '@/context/PlantContext';
import {
  cycleTimeHistory,
  formatChartDate,
  utilizationByPlant,
  utilizationPercent,
} from '@/mocks';
import type { CycleTimePoint, UtilizationData } from '@/mocks/types';

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

export function useAnalytics(): UseAnalyticsReturn {
  const { selectedPlant } = usePlant();

  const cycleTimePoints = useMemo<CycleTimeChartPoint[]>(
    () =>
      cycleTimeHistory.map((p: CycleTimePoint) => ({
        label: formatChartDate(p.date),
        avgMinutes: p.avgMinutes,
      })),
    []
  );

  const utilization = useMemo<UtilizationData>(
    () =>
      utilizationByPlant[selectedPlant.plantId] ?? {
        productiveHours: 0,
        idleHours: 0,
        maintenanceHours: 0,
      },
    [selectedPlant.plantId]
  );

  const utilizationPct = useMemo(
    () => utilizationPercent(utilization),
    [utilization]
  );

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
    loading: false,
    error: null,
  };
}
