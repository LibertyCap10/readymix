/**
 * useDispatchMap — composite hook for the dispatch map page.
 *
 * Combines useOrders + useFleet + usePlant and derives map-specific
 * data: mappable orders (with coordinates), mappable trucks, and
 * available trucks for assignment.
 */

import { useMemo } from 'react';
import { usePlant } from '@/context/PlantContext';
import { useOrders } from '@/hooks/useOrders';
import { useFleet } from '@/hooks/useFleet';

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
  const { trucks, loading: trucksLoading, error: trucksError } = useFleet();

  const activeOrders = useMemo(
    () => orders.filter(o => !['complete', 'cancelled'].includes(o.status)),
    [orders],
  );

  const mappableOrders = useMemo(
    () => activeOrders.filter(o => o.jobSiteLatitude != null && o.jobSiteLongitude != null),
    [activeOrders],
  );

  const mappableTrucks = useMemo(
    () => trucks.filter(t => t.latitude != null && t.longitude != null),
    [trucks],
  );

  const availableTrucks = useMemo(
    () => trucks.filter(t => t.currentStatus === 'available'),
    [trucks],
  );

  return {
    plant: selectedPlant,
    orders: mappableOrders,
    allOrders: orders,
    activeOrders,
    trucks: mappableTrucks,
    allTrucks: trucks,
    availableTrucks,
    loading: ordersLoading || trucksLoading,
    error: ordersError || trucksError,
    selectedDate,
    setSelectedDate,
    createOrder,
    updateOrderStatus,
    assignTruck,
  };
}
