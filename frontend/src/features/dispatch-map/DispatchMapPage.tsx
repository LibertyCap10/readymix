/**
 * DispatchMapPage — Mapbox-powered dispatch view.
 *
 * Desktop: split layout with map (flex) + side panel (360px)
 * Mobile: full-screen map with bottom sheet overlay
 */

import { useState, useCallback } from 'react';
import { Alert, Box, CircularProgress, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatchMap } from './useDispatchMap';
import { useMapRoutes } from './useMapRoutes';
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
    activeOrders,
    trucks,
    availableTrucks,
    loading,
    error,
    updateOrderStatus,
    assignTruck,
  } = useDispatchMap();

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
      // Also advance to dispatched if still pending
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

  if (isMobile) {
    return (
      <Box sx={{ height: '100%', position: 'relative' }}>
        <MapView
          plant={plant}
          orders={orders}
          trucks={trucks}
          routes={routes}
          selectedTicket={selectedTicket}
          onOrderSelect={handleOrderSelect}
          onTruckSelect={handleTruckSelect}
          onAssignTruck={handleAssignTruck}
          onUpdateStatus={handleUpdateStatus}
        />
        <BottomSheet orders={activeOrders} onOrderSelect={handleOrderSelect} />
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

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MapView
          plant={plant}
          orders={orders}
          trucks={trucks}
          routes={routes}
          selectedTicket={selectedTicket}
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
          orders={allOrders}
          onOrderSelect={handleOrderSelect}
          onClose={() => setSidePanelOpen(false)}
          selectedTicket={selectedTicket ?? undefined}
        />
      )}
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
