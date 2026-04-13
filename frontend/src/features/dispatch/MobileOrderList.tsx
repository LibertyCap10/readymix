/**
 * MobileOrderList — card-based order list for viewports narrower than 768 px.
 *
 * Why a separate component instead of just hiding the grid?
 * AG Grid renders a heavy virtualised canvas; on small phones it's sluggish
 * and the horizontal scrolling hurts UX. Cards are lightweight and tap-friendly.
 * The grid and this list share the same `orders` prop so they're always in sync.
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
import dayjs from 'dayjs';
import type { Order } from '@/types/domain';
import { StatusChip } from '@/components/StatusChip';

interface MobileOrderListProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

export function MobileOrderList({ orders, onOrderClick }: MobileOrderListProps) {
  if (!orders.length) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">No orders for this day.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      {orders.map((order) => (
        <Card key={order.ticketNumber} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardActionArea onClick={() => onOrderClick(order)}>
            <CardContent sx={{ pb: '12px !important' }}>

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
                    {dayjs(order.requestedTime).format('h:mm A')}
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
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
}
