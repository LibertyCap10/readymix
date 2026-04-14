/**
 * UnassignedSidebar — right panel listing pending orders that have no truck assigned.
 * Each card is a compact order summary that can be selected for assignment.
 */

import { Box, Typography, Paper, Chip, Divider } from '@mui/material';
import { LocalFireDepartment, AccessTime, Place } from '@mui/icons-material';
import type { Order } from '@/types/domain';
import dayjs from 'dayjs';
import { getOrderDisplayTime } from '@/utils/orderTime';

interface UnassignedSidebarProps {
  orders: Order[];
  onOrderClick?: (ticketNumber: string) => void;
}

export function UnassignedSidebar({ orders, onOrderClick }: UnassignedSidebarProps) {
  if (orders.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          All orders assigned
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
      <Typography variant="subtitle2" sx={{ px: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        Unassigned
        <Chip label={orders.length} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
      </Typography>

      <Divider />

      {orders
        .sort((a, b) => dayjs(a.targetTime ?? a.requestedTime).valueOf() - dayjs(b.targetTime ?? b.requestedTime).valueOf())
        .map((order) => (
          <Paper
            key={order.ticketNumber}
            variant="outlined"
            onClick={() => onOrderClick?.(order.ticketNumber)}
            sx={{
              p: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                {order.ticketNumber}
              </Typography>
              {order.isHotLoad && (
                <LocalFireDepartment sx={{ fontSize: 14, color: '#D84315' }} />
              )}
            </Box>

            <Typography variant="caption" display="block" noWrap>
              {order.customerName}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Place sx={{ fontSize: 12, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.65rem' }}>
                {order.jobSiteName}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTime sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {getOrderDisplayTime(order).time}
                </Typography>
              </Box>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                {order.volume} yd³
              </Typography>
            </Box>
          </Paper>
        ))}
    </Box>
  );
}
