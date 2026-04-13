/**
 * BottomSheet — mobile order list shown as a draggable bottom drawer.
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  SwipeableDrawer,
  Stack,
  Typography,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { StatusChip } from '@/components/StatusChip';
import type { Order } from '@/types/domain';

interface BottomSheetProps {
  orders: Order[];
  onOrderSelect: (order: Order) => void;
}

export function BottomSheet({ orders, onOrderSelect }: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false);

  const activeOrders = orders.filter(o => !['complete', 'cancelled'].includes(o.status));

  return (
    <>
      {/* Collapsed handle — always visible */}
      {!expanded && (
        <Box
          onClick={() => setExpanded(true)}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            borderRadius: '12px 12px 0 0',
            px: 2,
            py: 1.5,
            cursor: 'pointer',
            zIndex: 10,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Box sx={{ width: 40, height: 4, bgcolor: 'grey.400', borderRadius: 2, mx: 'auto', mb: 1 }} />
          <Typography variant="subtitle2" fontWeight={700}>
            {activeOrders.length} Active Order{activeOrders.length !== 1 ? 's' : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tap to view
          </Typography>
        </Box>
      )}

      {/* Expanded drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={expanded}
        onClose={() => setExpanded(false)}
        onOpen={() => setExpanded(true)}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            maxHeight: '60vh',
            borderRadius: '12px 12px 0 0',
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 4, bgcolor: 'grey.400', borderRadius: 2, mx: 'auto', mb: 1 }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Today's Orders ({orders.length})
          </Typography>
        </Box>
        <Box sx={{ overflow: 'auto', px: 2, pb: 2 }}>
          <Stack spacing={1}>
            {orders.map(order => (
              <Card
                key={order.ticketNumber}
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <CardActionArea onClick={() => { onOrderSelect(order); setExpanded(false); }}>
                  <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                      <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                        {order.ticketNumber}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {order.isHotLoad && (
                          <Chip
                            icon={<LocalFireDepartmentIcon />}
                            label="HOT"
                            size="small"
                            sx={{ height: 20, fontSize: 10, bgcolor: '#FFEBEE', color: '#C62828', '& .MuiChip-icon': { color: '#C62828', fontSize: 12 } }}
                          />
                        )}
                        <StatusChip status={order.status} variant="order" />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {order.customerName} -- {order.jobSiteName} -- {order.volume} yd{'\u00b3'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Box>
      </SwipeableDrawer>
    </>
  );
}
