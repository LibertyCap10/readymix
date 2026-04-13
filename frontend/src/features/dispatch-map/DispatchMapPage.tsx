/**
 * DispatchMapPage — Mapbox-powered dispatch view.
 *
 * Desktop: toolbar + split layout with map (flex) + side panel (360px)
 * Mobile: toolbar + full-screen map with bottom sheet overlay
 */

import { useState, useCallback, useMemo } from 'react';
import { Alert, Box, CircularProgress, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatchMap } from './useDispatchMap';
import { useMapRoutes } from './useMapRoutes';
import { useDispatchMapFilters } from './useDispatchMapFilters';
import { MapToolbar } from './MapToolbar';
import { MapView } from './MapView';
import { SidePanel } from './SidePanel';
import { BottomSheet } from './BottomSheet';
import { AssignTruckDialog } from './AssignTruckDialog';
import type { Order, Truck } from '@/types/domain';
import type { OrderStatus } from '@/theme/statusColors';

export function DispatchMapPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    plant,
    orders,
    allOrders,
    trucks,
    availableTrucks,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    updateOrderStatus,
    assignTruck,
  } = useDispatchMap();

  // Filters — applied to allOrders so status filtering works across all statuses
  const filters = useDispatchMapFilters(allOrders);

  // Mappable subset of filtered orders (have coordinates)
  const mappableFilteredOrders = useMemo(
    () => filters.filteredOrders.filter(
      o => o.jobSiteLatitude != null && o.jobSiteLongitude != null,
    ),
    [filters.filteredOrders],
  );

  // Routes are fetched for ALL active orders (not just filtered) so they're
  // ready instantly when the user selects an order or toggles "show all routes"
  const routes = useMapRoutes(orders, plant);

  // UI state
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);

  const handleOrderSelect = useCallback((order: Order) => {
    setSelectedTicket(order.ticketNumber);
  }, []);

  const handleTruckSelect = useCallback((_truck: Truck) => {
    // Future: could highlight the truck's current order
  }, []);

  const handleAssignTruck = useCallback((order: Order) => {
    setAssignOrder(order);
  }, []);

  const handleDoAssign = useCallback(
    async (ticketNumber: string, truckId: string, truckNumber: string, driverName: string) => {
      await assignTruck(ticketNumber, truckId, truckNumber, driverName);
      await updateOrderStatus(ticketNumber, 'dispatched');
    },
    [assignTruck, updateOrderStatus],
  );

  const handleUpdateStatus = useCallback(
    async (ticketNumber: string, status: OrderStatus) => {
      await updateOrderStatus(ticketNumber, status);
    },
    [updateOrderStatus],
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const toolbar = (
    <MapToolbar
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      statusFilters={filters.statusFilters}
      onToggleStatus={filters.toggleStatus}
      statusCounts={filters.statusCounts}
      searchQuery={filters.searchQuery}
      onSearchChange={filters.setSearchQuery}
      hotLoadOnly={filters.hotLoadOnly}
      onHotLoadToggle={() => filters.setHotLoadOnly(v => !v)}
      showTrucks={filters.showTrucks}
      onTrucksToggle={() => filters.setShowTrucks(v => !v)}
      showAllRoutes={filters.showAllRoutes}
      onRoutesToggle={() => filters.setShowAllRoutes(v => !v)}
      isFiltered={filters.isFiltered}
      onClearFilters={filters.clearFilters}
      filteredCount={filters.filteredOrders.length}
      totalCount={filters.totalCount}
    />
  );

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {toolbar}
        <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <MapView
            plant={plant}
            orders={mappableFilteredOrders}
            trucks={trucks}
            routes={routes}
            selectedTicket={selectedTicket}
            showAllRoutes={filters.showAllRoutes}
            showTrucks={filters.showTrucks}
            onOrderSelect={handleOrderSelect}
            onTruckSelect={handleTruckSelect}
            onAssignTruck={handleAssignTruck}
            onUpdateStatus={handleUpdateStatus}
          />
          <BottomSheet orders={filters.filteredOrders} onOrderSelect={handleOrderSelect} />
          <AssignTruckDialog
            open={!!assignOrder}
            onClose={() => setAssignOrder(null)}
            order={assignOrder}
            availableTrucks={availableTrucks}
            onAssign={handleDoAssign}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {toolbar}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <MapView
            plant={plant}
            orders={mappableFilteredOrders}
            trucks={trucks}
            routes={routes}
            selectedTicket={selectedTicket}
            showAllRoutes={filters.showAllRoutes}
            showTrucks={filters.showTrucks}
            onOrderSelect={handleOrderSelect}
            onTruckSelect={handleTruckSelect}
            onAssignTruck={handleAssignTruck}
            onUpdateStatus={handleUpdateStatus}
            sidePanelHidden={!sidePanelOpen}
            onToggleSidePanel={() => setSidePanelOpen(true)}
          />
        </Box>
        {sidePanelOpen && (
          <SidePanel
            orders={filters.filteredOrders}
            totalCount={filters.totalCount}
            isFiltered={filters.isFiltered}
            onOrderSelect={handleOrderSelect}
            onClose={() => setSidePanelOpen(false)}
            selectedTicket={selectedTicket ?? undefined}
          />
        )}
      </Box>
      <AssignTruckDialog
        open={!!assignOrder}
        onClose={() => setAssignOrder(null)}
        order={assignOrder}
        availableTrucks={availableTrucks}
        onAssign={handleDoAssign}
      />
    </Box>
  );
}
