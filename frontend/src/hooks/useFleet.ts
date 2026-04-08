/**
 * useFleet — data hook for the Fleet View.
 *
 * Returns trucks for the selected plant with live-updating statuses from
 * useFleetTicker. Components read from this hook; they never touch mock
 * data or the ticker directly.
 *
 * Phase 6: internals swap to:
 *   - Initial data: GET /fleet?plantId  (Aurora master + DynamoDB status)
 *   - Live updates: polling GET /fleet/status?plantId every 10s
 * The returned interface stays identical.
 */

import { useMemo } from 'react';
import { usePlant } from '@/context/PlantContext';
import { trucks as allTrucks } from '@/mocks';
import type { Truck } from '@/mocks/types';
import type { TruckStatus } from '@/theme/statusColors';
import { useFleetTicker } from '@/features/fleet/useFleetTicker';

export interface UseFleetReturn {
  trucks: Truck[];           // master data with live status applied
  loading: boolean;
  error: string | null;
  secondsUntilNext: number;  // countdown for live-update badge
  statusCounts: Record<TruckStatus, number>; // pre-computed for bar chart
}

export function useFleet(): UseFleetReturn {
  const { selectedPlant } = usePlant();

  // Filter to selected plant
  const plantTrucks = useMemo(
    () => allTrucks.filter((t) => t.plantId === selectedPlant.plantId),
    [selectedPlant.plantId]
  );

  // Build initial status map from mock data
  const initialStatuses = useMemo(
    () =>
      plantTrucks.reduce<Record<string, TruckStatus>>(
        (acc, t) => ({ ...acc, [t.truckId]: t.currentStatus }),
        {}
      ),
    [plantTrucks]
  );

  const plantTruckIds = useMemo(
    () => plantTrucks.map((t) => t.truckId),
    [plantTrucks]
  );

  const { statuses, secondsUntilNext } = useFleetTicker({
    initialStatuses,
    plantTruckIds,
  });

  // Merge live statuses into truck master data
  const trucksWithLiveStatus = useMemo<Truck[]>(
    () =>
      plantTrucks.map((t) => ({
        ...t,
        currentStatus: statuses[t.truckId] ?? t.currentStatus,
      })),
    [plantTrucks, statuses]
  );

  // Pre-aggregate status counts for the bar chart
  const statusCounts = useMemo<Record<TruckStatus, number>>(
    () => {
      const counts: Record<TruckStatus, number> = {
        available:   0,
        loading:     0,
        in_transit:  0,
        pouring:     0,
        returning:   0,
        maintenance: 0,
      };
      trucksWithLiveStatus.forEach((t) => {
        counts[t.currentStatus] = (counts[t.currentStatus] ?? 0) + 1;
      });
      return counts;
    },
    [trucksWithLiveStatus]
  );

  return {
    trucks: trucksWithLiveStatus,
    loading: false,
    error: null,
    secondsUntilNext,
    statusCounts,
  };
}
