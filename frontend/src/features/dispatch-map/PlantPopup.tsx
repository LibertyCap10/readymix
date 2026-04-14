/**
 * PlantPopup — Mapbox popup anchored to the plant marker showing
 * plant details, all trucks belonging to this plant, and all orders
 * for the day.
 */

import { Popup } from 'react-map-gl/mapbox';
import {
  Box,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PhoneIcon from '@mui/icons-material/Phone';
import { StatusChip } from '@/components/StatusChip';
import { truckStatusColors } from '@/theme/statusColors';
import type { OrderStatus, TruckStatus } from '@/theme/statusColors';
import type { Plant, Truck, Order } from '@/types/domain';

interface PlantPopupProps {
  plant: Plant;
  trucks: Truck[];
  orders: Order[];
  onClose: () => void;
  onAssignTruck: (order: Order) => void;
  isToday?: boolean;
  isPastDate?: boolean;
}

export function PlantPopup({
  plant,
  trucks,
  orders,
  onClose,
  onAssignTruck,
  isToday = true,
  isPastDate = false,
}: PlantPopupProps) {
  return (
    <Popup
      longitude={plant.longitude}
      latitude={plant.latitude}
      anchor="top"
      onClose={onClose}
      closeButton
      closeOnClick={false}
      maxWidth="400px"
    >
      <Box sx={{ p: 0.5, minWidth: 300 }}>
        {/* Plant header */}
        <Typography variant="subtitle2" fontWeight={700}>
          {plant.name}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
          {plant.address}, {plant.city}, {plant.state}
        </Typography>
        {plant.phone && (
          <Typography variant="caption" display="block" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PhoneIcon sx={{ fontSize: 12 }} /> {plant.phone}
          </Typography>
        )}

        {/* All trucks */}
        <Divider sx={{ my: 1 }} />
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Fleet ({trucks.length})
        </Typography>

        <Box sx={{ maxHeight: 200, overflow: 'auto', opacity: isPastDate ? 0.5 : 1 }}>
          {trucks.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1, pl: 1 }}>
              No trucks assigned to this plant.
            </Typography>
          ) : (
            <List dense disablePadding>
              {trucks.map(truck => {
                const statusColor = truckStatusColors[truck.currentStatus as TruckStatus];
                return (
                  <ListItem key={truck.truckId} sx={{ py: 0.25, px: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LocalShippingIcon
                        sx={{ fontSize: 18, color: isPastDate ? '#9E9E9E' : (statusColor?.text ?? '#666') }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                            Truck {truck.truckNumber}
                          </Typography>
                          <StatusChip status={truck.currentStatus as TruckStatus} variant="truck" />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary" component="span">
                          {truck.driver.name} -- {truck.capacity} yd{'\u00b3'}{isPastDate ? ` -- ${truck.loadsToday} loads completed` : ` -- ${truck.loadsToday} loads today`}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        {/* All orders for the day */}
        <Divider sx={{ my: 1 }} />
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Orders ({orders.length}){isPastDate ? ' -- Completed' : ''}
        </Typography>

        <Box sx={{ maxHeight: 250, overflow: 'auto', opacity: isPastDate ? 0.5 : 1 }}>
          {orders.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1, pl: 1 }}>
              {isPastDate ? 'No orders for this date.' : isToday ? 'No orders for today.' : 'No orders scheduled.'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {orders.map(order => {
                const showAssign = order.status === 'pending' && !isPastDate;
                return (
                  <ListItem
                    key={order.ticketNumber}
                    sx={{ py: 0.5, px: 0.5, alignItems: 'flex-start' }}
                    secondaryAction={
                      showAssign ? (
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ minWidth: 0, px: 1, fontSize: '0.7rem' }}
                          onClick={() => onAssignTruck(order)}
                        >
                          Assign
                        </Button>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                            {order.ticketNumber.replace('TKT-2026-', '')}
                          </Typography>
                          <StatusChip status={order.status as OrderStatus} variant="order" />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" color="text.secondary" component="span" display="block">
                            {order.customerName} -- {order.jobSiteName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="span" display="block">
                            {order.mixDesignName} -- {order.volume} yd{'\u00b3'}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Box>
    </Popup>
  );
}
