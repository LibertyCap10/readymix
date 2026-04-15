/**
 * MobileOrderList — card-based order list for viewports narrower than 900px.
 *
 * Cards are lightweight and tap-friendly with status-colored left borders
 * and a lifecycle progress bar at the bottom.
 */

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import type { Order } from '@/types/domain';
import { StatusChip } from '@/components/StatusChip';
import { getOrderDisplayTime } from '@/utils/orderTime';
import { orderStatusColors } from '@/theme/statusColors';
import type { OrderStatus } from '@/theme/statusColors';

interface MobileOrderListProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

const STATUS_PROGRESS: Record<OrderStatus, number> = {
  pending: 10,
  scheduled: 25,
  dispatched: 40,
  in_transit: 60,
  pouring: 75,
  returning: 90,
  complete: 100,
  cancelled: 100,
};

export function MobileOrderList({ orders, onOrderClick }: MobileOrderListProps) {
  if (!orders.length) return null;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {orders.map((order) => {
        const statusColor = orderStatusColors[order.status as OrderStatus];
        const progress = STATUS_PROGRESS[order.status as OrderStatus] ?? 0;

        return (
          <Card
            key={order.ticketNumber}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderLeft: '3px solid',
              borderLeftColor: statusColor?.text ?? 'divider',
              overflow: 'hidden',
            }}
          >
            <CardActionArea
              onClick={() => onOrderClick(order)}
              sx={{
                transition: 'transform 0.1s ease',
                '&:active': { transform: 'scale(0.99)' },
              }}
            >
              <CardContent sx={{ pb: '8px !important' }}>

                {/* Row 1: Ticket # + hot load + status */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}
                    >
                      {order.ticketNumber}
                    </Typography>
                    {order.isHotLoad && (
                      <Chip
                        icon={<LocalFireDepartmentIcon />}
                        label="HOT"
                        size="small"
                        sx={{
                          bgcolor: 'error.main',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 10,
                          height: 20,
                          animation: 'hotPulse 2s ease-in-out infinite',
                          '@keyframes hotPulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.7 },
                          },
                          '& .MuiChip-icon': { color: '#fff', fontSize: 12 },
                        }}
                      />
                    )}
                  </Box>
                  <StatusChip status={order.status} />
                </Box>

                {/* Row 2: Customer + mix design */}
                <Typography variant="body2" fontWeight={600} noWrap>
                  {order.customerName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {order.mixDesignName} · {order.psi} PSI · {order.volume} yd³
                </Typography>

                <Divider sx={{ my: 1 }} />

                {/* Row 3: Job site + time */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                    <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                    <Typography variant="caption" noWrap color="text.secondary">
                      {order.jobSiteName}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {(() => {
                        const dt = getOrderDisplayTime(order);
                        return dt.label !== 'Requested' ? `${dt.label} ${dt.time}` : dt.time;
                      })()}
                    </Typography>
                  </Stack>
                </Box>

                {/* Row 4: Truck assignment (if any) */}
                {order.assignedTruckNumber && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Truck #{order.assignedTruckNumber}
                    {order.driverName ? ` · ${order.driverName}` : ''}
                  </Typography>
                )}
              </CardContent>

              {/* Progress bar showing lifecycle position */}
              <Box sx={{ height: 3, bgcolor: 'grey.100' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: `${progress}%`,
                    bgcolor: statusColor?.text ?? 'grey.400',
                    borderRadius: '0 1px 1px 0',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}
