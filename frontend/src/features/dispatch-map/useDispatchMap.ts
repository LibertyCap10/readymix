/**
 * useDispatchMap — composite hook for the dispatch map page.
 *
 * Combines useOrders + useFleet + usePlant and derives map-specific
 * data: mappable orders (with coordinates), mappable trucks, and
 * available trucks for assignment.
 *
 * For non-today dates, truck states are synthesized from the date's
 * orders so the map shows a contextual view (all trucks at plant,
 * with past dates greyed out and future dates showing available/scheduled).
 */

import { useMemo } from 'react';
import dayjs from 'dayjs';
import { usePlant } from '@/context/PlantContext';
import { useOrders } from '@/hooks/useOrders';
import { useFleet } from '@/hooks/useFleet';
import type { Truck } from '@/types/domain';

export function useDispatchMap() {
  const { selectedPlant } = usePlant();
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    selectedDate,
    setSelectedDate,
    createOrder,
    updateOrderStatus,
    assignTruck,
  } = useOrders();
  const { trucks, loading: trucksLoading, error: trucksError, refreshFleet } = useFleet();

  const today = dayjs().format('YYYY-MM-DD');
  const isToday = selectedDate === today;
  const isPastDate = selectedDate < today;

  // ── Date-aware truck states ───────────────────────────────────────────────
  // For non-today dates, override truck status and position from the date's
  // orders. Live fleet data provides master data (IDs, drivers, capacity).
  const dateAwareTrucks = useMemo<Truck[]>(() => {
    if (isToday) return trucks;

    return trucks.map(truck => {
      const truckOrders = orders.filter(o => o.assignedTruckId === truck.truckId);

      let currentStatus: Truck['currentStatus'];
      let loadsToday: number;

      if (isPastDate) {
        // Past: all work is done — truck is back at plant
        currentStatus = 'available';
        loadsToday = truckOrders.filter(o => o.status === 'complete').length;
      } else {
        // Future: truck is available or scheduled for upcoming work
        const hasAssignment = truckOrders.some(o =>
          ['pending', 'scheduled'].includes(o.status),
        );
        currentStatus = hasAssignment ? 'scheduled' : 'available';
        loadsToday = 0;
      }

      return {
        ...truck,
        currentStatus,
        loadsToday,
        currentOrderId: undefined,
        currentJobSite: undefined,
        latitude: selectedPlant.latitude,
        longitude: selectedPlant.longitude,
      };
    });
  }, [isToday, isPastDate, trucks, orders, selectedPlant]);

  const activeOrders = useMemo(
    () => orders.filter(o => !['complete', 'cancelled'].includes(o.status)),
    [orders],
  );

  const mappableOrders = useMemo(
    () => activeOrders.filter(o => o.jobSiteLatitude != null && o.jobSiteLongitude != null),
    [activeOrders],
  );

  const mappableTrucks = useMemo(
    () => dateAwareTrucks.filter(t => t.latitude != null && t.longitude != null),
    [dateAwareTrucks],
  );

  const availableTrucks = useMemo(
    () => dateAwareTrucks.filter(t => t.currentStatus === 'available'),
    [dateAwareTrucks],
  );

  return {
    plant: selectedPlant,
    orders: mappableOrders,
    allOrders: orders,
    activeOrders,
    trucks: mappableTrucks,
    allTrucks: dateAwareTrucks,
    availableTrucks,
    loading: ordersLoading || trucksLoading,
    error: ordersError || trucksError,
    selectedDate,
    setSelectedDate,
    isToday,
    isPastDate,
    createOrder,
    updateOrderStatus,
    assignTruck,
    refreshFleet,
  };
}
