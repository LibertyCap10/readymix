/**
 * useFleet — data hook for the Fleet View.
 *
 * Phase 6: fetches truck data from the API via useFleetTicker polling.
 * Maps API response to the Truck type and computes status aggregations.
 * The returned interface stays identical to Phase 3.
 */

import { useMemo } from 'react';
import { usePlant } from '@/context/PlantContext';
import type { Truck } from '@/types/domain';
import type { TruckStatus } from '@/theme/statusColors';
import { useFleetTicker } from '@/features/fleet/useFleetTicker';

export interface UseFleetReturn {
  trucks: Truck[];           // master data with live status applied
  loading: boolean;
  error: string | null;
  secondsUntilNext: number;  // countdown for live-update badge
  statusCounts: Record<TruckStatus, number>; // pre-computed for bar chart
  refreshFleet: () => Promise<void>;  // trigger immediate refresh (e.g., after assignment)
}

export function useFleet(): UseFleetReturn {
  const { selectedPlant } = usePlant();

  const { trucks: apiTrucks, secondsUntilNext, loading, error, refreshNow } = useFleetTicker({
    plantId: selectedPlant.plantId,
  });

  // Map API response to the Truck type expected by components.
  // The DynamoDB fleet response may lack some master-data fields that
  // the mock data had (driver details, VIN, etc). Fill defaults.
  const trucks = useMemo<Truck[]>(
    () =>
      apiTrucks.map((t) => ({
        truckId: t.truckId,
        truckNumber: t.truckNumber ?? t.truckId,
        plantId: t.plantId,
        type: (t.type ?? 'rear_discharge') as Truck['type'],
        capacity: t.capacity ?? 12,
        year: t.year ?? 2022,
        make: t.make ?? '',
        model: t.model ?? '',
        vin: t.vin ?? '',
        driver: {
          driverId: t.driverId ?? '',
          name: t.driverName ?? '',
          phone: '',
          certifications: [],
        },
        currentStatus: t.currentStatus,
        currentJobSite: t.currentJobSite ?? undefined,
        currentOrderId: t.currentOrderId ?? undefined,
        lastWashout: t.lastUpdated ?? new Date().toISOString(),
        loadsToday: t.loadsToday ?? 0,
        latitude: t.latitude ?? undefined,
        longitude: t.longitude ?? undefined,
      })),
    [apiTrucks]
  );

  // Pre-aggregate status counts for the bar chart
  const statusCounts = useMemo<Record<TruckStatus, number>>(
    () => {
      const counts: Record<TruckStatus, number> = {
        available:   0,
        scheduled:   0,
        loading:     0,
        in_transit:  0,
        pouring:     0,
        returning:   0,
        maintenance: 0,
      };
      trucks.forEach((t) => {
        counts[t.currentStatus] = (counts[t.currentStatus] ?? 0) + 1;
      });
      return counts;
    },
    [trucks]
  );

  return {
    trucks,
    loading,
    error,
    secondsUntilNext,
    statusCounts,
    refreshFleet: refreshNow,
  };
}
