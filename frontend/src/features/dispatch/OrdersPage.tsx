/**
 * DispatchPage — the main dispatch board.
 *
 * Layout:
 *   ┌─ PageHeader ────────────────────────────────────────────┐
 *   │  [Date Picker]  Day · Stats          [+ New Order]      │
 *   │  [Status chips: All | Pending | ...]                    │
 *   └──────────────────────────────────────────────────────────┘
 *   ┌─ Grid (desktop) / Card list (mobile ≤900px) ────────────┐
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *   ┌─ OrderDetailDrawer (right side, slides in on row click) ─┐
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewListIcon from '@mui/icons-material/ViewList';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useOrders } from '@/hooks/useOrders';
import { DispatchGrid } from './DispatchGrid';
import { MobileOrderList } from './MobileOrderList';
import { OrderDetailDrawer } from '@/components/OrderDetailDrawer';
import { NewOrderDialog } from './NewOrderDialog';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonGrid, SkeletonCards } from '@/components/SkeletonLoader';
import type { Order } from '@/types/domain';
import type { OrderStatus } from '@/theme/statusColors';
import { orderStatusColors } from '@/theme/statusColors';

// ─── Status filter chips ──────────────────────────────────────────────────────

type StatusFilter = OrderStatus | 'all';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    orders,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    createOrder,
    updateRequestedTime,
    deleteOrder,
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

  const handlePrevDay = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, setSelectedDate]);

  const handleNextDay = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, setSelectedDate]);

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

  const dayOfWeek = dayjs(selectedDate).format('dddd');
  const totalVolume = orders.reduce((s, o) => s + o.volume, 0).toFixed(1);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Page Header ────────────────────────────────────────────── */}
      <PageHeader
        title="Orders"
        subtitle={dayOfWeek}
        rightContent={
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
        }
        bottomContent={
          <Box>
            {/* Date picker + stats row */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={handlePrevDay}
                  sx={{ width: 32, height: 32, border: '1px solid', borderColor: 'divider' }}
                >
                  <ChevronLeftIcon sx={{ fontSize: 20 }} />
                </IconButton>
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
                <IconButton
                  size="small"
                  onClick={handleNextDay}
                  sx={{ width: 32, height: 32, border: '1px solid', borderColor: 'divider' }}
                >
                  <ChevronRightIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Stack>

              <Box
                sx={{
                  bgcolor: 'grey.50',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 99,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  <Typography component="span" variant="body2" fontWeight={700} color="text.primary">
                    {orders.length}
                  </Typography>{' '}
                  orders{' \u00b7 '}
                  <Typography component="span" variant="body2" fontWeight={700} color="text.primary">
                    {totalVolume}
                  </Typography>{' '}
                  yd³
                </Typography>
              </Box>
            </Stack>

            {/* Status filter chips */}
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
          </Box>
        }
      />

      {/* ── Error banner ───────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* ── Grid / Card list ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: isMobile ? 'auto' : 'hidden' }}>
        {loading ? (
          isMobile ? <SkeletonCards count={4} /> : <SkeletonGrid rows={6} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={ViewListIcon}
            title="No orders found"
            description={
              statusFilter !== 'all'
                ? `No ${statusFilter.replace('_', ' ')} orders for ${dayjs(selectedDate).format('MMMM D, YYYY')}.`
                : `No orders for ${dayjs(selectedDate).format('MMMM D, YYYY')}.`
            }
            action={
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                size="small"
                onClick={handleNewOrder}
              >
                New Order
              </Button>
            }
          />
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
        onUpdateRequestedTime={updateRequestedTime}
        onDeleteOrder={async (ticketNumber) => {
          await deleteOrder(ticketNumber);
          setSelectedOrder(null);
          setDrawerOpen(false);
        }}
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
