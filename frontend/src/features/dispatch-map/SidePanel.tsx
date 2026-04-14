/**
 * SidePanel — collapsible right panel showing today's orders.
 * Desktop only — on mobile, BottomSheet is used instead.
 *
 * Receives pre-filtered orders from the toolbar's filter state.
 */

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { StatusChip } from '@/components/StatusChip';
import type { Order } from '@/types/domain';
import { getOrderDisplayTime } from '@/utils/orderTime';
import type { OrderStatus } from '@/theme/statusColors';

const STATUS_ORDER: OrderStatus[] = [
  'pending', 'scheduled', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled',
];

interface SidePanelProps {
  orders: Order[];
  totalCount: number;
  isFiltered: boolean;
  onOrderSelect: (order: Order) => void;
  onClose: () => void;
  selectedTicket?: string;
}

export function SidePanel({ orders, totalCount, isFiltered, onOrderSelect, onClose, selectedTicket }: SidePanelProps) {
  // Group orders by status
  const grouped = STATUS_ORDER
    .map(status => ({
      status,
      orders: orders.filter(o => o.status === status),
    }))
    .filter(g => g.orders.length > 0);

  return (
    <Box
      sx={{
        width: 360,
        flexShrink: 0,
        borderLeft: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Today's Orders</Typography>
          <Typography variant="caption" color="text.secondary">
            {isFiltered
              ? `${orders.length} of ${totalCount} orders`
              : `${orders.length} order${orders.length !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Order list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {orders.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {isFiltered ? 'No orders match filters.' : 'No orders for today.'}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {grouped.map(group => (
              <Box key={group.status}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, px: 0.5 }}>
                  <StatusChip status={group.status} variant="order" />
                  <Typography variant="caption" color="text.secondary">
                    ({group.orders.length})
                  </Typography>
                </Box>
                <Stack spacing={0.75}>
                  {group.orders.map(order => (
                    <Card
                      key={order.ticketNumber}
                      elevation={0}
                      sx={{
                        border: '1px solid',
                        borderColor: selectedTicket === order.ticketNumber ? 'primary.main' : 'divider',
                        bgcolor: selectedTicket === order.ticketNumber ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <CardActionArea onClick={() => onOrderSelect(order)}>
                        <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                              {order.ticketNumber}
                            </Typography>
                            {order.isHotLoad && (
                              <Chip
                                icon={<LocalFireDepartmentIcon />}
                                label="HOT"
                                size="small"
                                sx={{ height: 20, fontSize: 10, bgcolor: '#FFEBEE', color: '#C62828', '& .MuiChip-icon': { color: '#C62828', fontSize: 12 } }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {order.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {order.jobSiteName} -- {order.volume} yd{'\u00b3'}
                          </Typography>
                          {(order.status === 'pending' || order.status === 'scheduled') && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {(() => {
                                  const dt = getOrderDisplayTime(order);
                                  return `${dt.label}: ${dt.time}`;
                                })()}
                              </Typography>
                            </Box>
                          )}
                          {order.assignedTruckNumber && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <LocalShippingIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                Truck {order.assignedTruckNumber} -- {order.driverName}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
