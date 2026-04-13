/**
 * DispatchPage — the main dispatch board.
 *
 * Layout:
 *   ┌─ Toolbar ────────────────────────────────────────────────┐
 *   │  [Date Picker]  [Status chips: All | Pending | ...]  [+ New Order]
 *   └──────────────────────────────────────────────────────────┘
 *   ┌─ Grid (desktop) / Card list (mobile ≤768px) ─────────────┐
 *   │                                                           │
 *   └──────────────────────────────────────────────────────────┘
 *   ┌─ OrderDetailDrawer (right side, slides in on row click) ─┐
 *
 * Responsive:
 *   useMediaQuery('(max-width: 768px)') switches from DispatchGrid → MobileOrderList
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useOrders } from '@/hooks/useOrders';
import { DispatchGrid } from './DispatchGrid';
import { MobileOrderList } from './MobileOrderList';
import { OrderDetailDrawer } from '@/components/OrderDetailDrawer';
import { NewOrderDialog } from './NewOrderDialog';
import type { Order } from '@/types/domain';
import type { OrderStatus } from '@/theme/statusColors';
import { orderStatusColors } from '@/theme/statusColors';

// ─── Status filter chips ──────────────────────────────────────────────────────

type StatusFilter = OrderStatus | 'all';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'dispatched',label: 'Dispatched' },
  { value: 'in_transit',label: 'In Transit' },
  { value: 'pouring',   label: 'Pouring' },
  { value: 'returning', label: 'Returning' },
  { value: 'complete',  label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function OrdersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // ≤900px

  const {
    orders,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    createOrder,
  } = useOrders();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  // ── Filtered orders ────────────────────────────────────────────────────────
  const filteredOrders =
    statusFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  // ── Order counts per status (for chip badges) ──────────────────────────────
  const countByStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOrderClick = useCallback((order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleDateChange = useCallback((dt: Dayjs | null) => {
    if (dt?.isValid()) setSelectedDate(dt.format('YYYY-MM-DD'));
  }, [setSelectedDate]);

  const handleNewOrder = useCallback(() => {
    setNewOrderOpen(true);
  }, []);

  const handleNewOrderSubmit = useCallback(
    async (draft: Parameters<typeof createOrder>[0]) => {
      const order = await createOrder(draft);
      setSelectedOrder(order);
      setDrawerOpen(true);
    },
    [createOrder]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          px: { xs: 1, sm: 2 },
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {/* Row 1: Date picker + stats + New Order button */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 0.75 }}
        >
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={handleDateChange}
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: { xs: 140, sm: 170 } },
              },
            }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            {orders.length} orders · {orders.reduce((s, o) => s + o.volume, 0).toFixed(1)} yd³
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            color="secondary"
            startIcon={isMobile ? undefined : <AddIcon />}
            size="small"
            onClick={handleNewOrder}
            sx={{ flexShrink: 0, fontWeight: 600, minWidth: 'auto', px: { xs: 1.5, sm: 2 } }}
          >
            {isMobile ? <AddIcon /> : 'New Order'}
          </Button>
        </Stack>

        {/* Row 2: Status filter chips — horizontally scrollable */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            overflowX: 'auto',
            pb: 0.25,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {FILTER_OPTIONS.map(({ value, label }) => {
            const count = value === 'all' ? orders.length : (countByStatus[value] ?? 0);
            const isActive = statusFilter === value;
            const colors = value !== 'all' ? orderStatusColors[value as OrderStatus] : undefined;

            return (
              <Chip
                key={value}
                label={`${label}${count > 0 ? ` (${count})` : ''}`}
                onClick={() => setStatusFilter(value)}
                size="small"
                sx={{
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: isActive ? 700 : 400,
                  fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                  height: { xs: 26, sm: 32 },
                  bgcolor: isActive ? (colors?.background ?? 'primary.main') : 'transparent',
                  color: isActive ? (colors?.text ?? 'primary.contrastText') : 'text.secondary',
                  border: '1px solid',
                  borderColor: isActive ? (colors?.text ?? 'primary.main') : 'divider',
                  '&:hover': {
                    bgcolor: colors?.background ?? 'action.hover',
                  },
                }}
              />
            );
          })}
        </Box>
      </Paper>

      {/* ── Error banner ───────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* ── Grid / Card list ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: isMobile ? 'auto' : 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredOrders.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body1">
              No {statusFilter !== 'all' ? statusFilter.replace('_', ' ') + ' ' : ''}orders
              for {dayjs(selectedDate).format('MMMM D, YYYY')}.
            </Typography>
          </Box>
        ) : isMobile ? (
          <MobileOrderList orders={filteredOrders} onOrderClick={handleOrderClick} />
        ) : (
          <DispatchGrid orders={filteredOrders} onOrderClick={handleOrderClick} />
        )}
      </Box>

      {/* ── Detail Drawer ──────────────────────────────────────────────── */}
      <OrderDetailDrawer
        order={selectedOrder}
        open={drawerOpen}
        onClose={handleDrawerClose}
      />

      {/* ── New Order Dialog ───────────────────────────────────────────── */}
      <NewOrderDialog
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        onSubmit={handleNewOrderSubmit}
      />
    </Box>
  );
}
