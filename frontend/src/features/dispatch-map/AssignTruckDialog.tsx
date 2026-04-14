/**
 * AssignTruckDialog — dialog for assigning or reassigning a truck to an order.
 *
 * Schedule-aware: shows all trucks sorted by availability, with estimated
 * available times for busy trucks and late arrival warnings.
 *
 * Includes a target-time picker that defaults to the order's requestedTime when
 * it's in the future, or suggests a realistic future time (30 min+ out, rounded
 * to the next 15-min increment) when the requested time has passed.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { truckStatusColors } from '@/theme/statusColors';
import type { TruckStatus } from '@/theme/statusColors';
import type { Order, Truck } from '@/types/domain';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

interface AssignTruckDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  availableTrucks: Truck[];
  allTrucks: Truck[];
  onAssign: (ticketNumber: string, truckId: string, truckNumber: string, driverName: string, targetTime: string) => Promise<void>;
}

interface TruckAvailability {
  truck: Truck;
  isAvailableNow: boolean;
  availableAt: string | null;     // ISO timestamp or null if available now
  lateByMinutes: number | null;   // how many minutes late vs target time, null if on time
  dailyOrderCount: number;        // how many orders already scheduled today
}

/** Compute a sensible default target time for dispatching. */
function computeDefaultTarget(order: Order): Dayjs {
  const requested = dayjs(order.requestedTime);
  // If requested time is more than 15 min in the future, use it
  if (requested.isAfter(dayjs().add(15, 'minute'))) {
    return requested;
  }
  // Otherwise, suggest 30 min from now rounded up to next 15-min increment
  const base = dayjs().add(30, 'minute');
  const remainder = base.minute() % 15;
  return remainder === 0
    ? base.second(0).millisecond(0)
    : base.add(15 - remainder, 'minute').second(0).millisecond(0);
}

export function AssignTruckDialog({
  open,
  onClose,
  order,
  availableTrucks: _availableTrucks,
  allTrucks,
  onAssign,
}: AssignTruckDialogProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetTime, setTargetTime] = useState<Dayjs>(dayjs());

  // Reset target time whenever order changes
  useEffect(() => {
    if (order) {
      setTargetTime(computeDefaultTarget(order));
      setSelectedTruck(null);
      setError(null);
    }
  }, [order]);

  const requestedInPast = useMemo(() => {
    if (!order) return false;
    return dayjs(order.requestedTime).isBefore(dayjs().add(15, 'minute'));
  }, [order]);

  // Build schedule-aware availability list
  const truckAvailability = useMemo((): TruckAvailability[] => {
    if (!order) return [];

    const orderDate = dayjs(order.requestedTime).format('YYYY-MM-DD');

    return allTrucks
      .filter(t => t.currentStatus !== 'maintenance')
      .map((truck): TruckAvailability => {
        const isAvailableNow = truck.currentStatus === 'available';
        // Check dailySchedule for today's blocks
        const todayBlocks = (truck as unknown as { dailySchedule?: Record<string, { ticketNumber: string; returnArrivalAt: string }[]> })
          .dailySchedule?.[orderDate] ?? [];
        const dailyOrderCount = todayBlocks.length;

        // Determine when truck will be available
        let availableAt: string | null = null;
        if (!isAvailableNow) {
          // Use estimatedAvailableAt if set, otherwise use last block's return
          availableAt = (truck as unknown as { estimatedAvailableAt?: string }).estimatedAvailableAt ?? null;
          if (!availableAt && todayBlocks.length > 0) {
            const lastBlock = todayBlocks[todayBlocks.length - 1];
            // Add 15 min buffer
            availableAt = dayjs(lastBlock.returnArrivalAt).add(15, 'minute').toISOString();
          }
        } else if (todayBlocks.length > 0) {
          // Available now but has scheduled blocks — find next available gap
          const lastBlock = todayBlocks[todayBlocks.length - 1];
          const lastReturn = dayjs(lastBlock.returnArrivalAt);
          if (lastReturn.isAfter(dayjs())) {
            availableAt = lastReturn.add(15, 'minute').toISOString();
          }
        }

        // Calculate potential late arrival vs target time
        let lateByMinutes: number | null = null;
        if (availableAt) {
          const availMs = dayjs(availableAt).valueOf();
          const targetMs = targetTime.valueOf();
          if (availMs > targetMs) {
            lateByMinutes = Math.round((availMs - targetMs) / 60000);
          }
        }

        return { truck, isAvailableNow, availableAt, lateByMinutes, dailyOrderCount };
      })
      .sort((a, b) => {
        // Available now first
        if (a.isAvailableNow && !b.isAvailableNow) return -1;
        if (!a.isAvailableNow && b.isAvailableNow) return 1;
        // Then by availability time (soonest first)
        if (a.availableAt && b.availableAt) {
          return dayjs(a.availableAt).valueOf() - dayjs(b.availableAt).valueOf();
        }
        // Then by truck number
        return a.truck.truckNumber.localeCompare(b.truck.truckNumber, undefined, { numeric: true });
      });
  }, [allTrucks, order, targetTime]);

  const handleAssign = async () => {
    if (!order || !selectedTruck) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAssign(
        order.ticketNumber,
        selectedTruck.truckId,
        selectedTruck.truckNumber,
        selectedTruck.driver.name,
        targetTime.toISOString(),
      );
      setSelectedTruck(null);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to assign truck');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAvailability = truckAvailability.find(ta => ta.truck.truckId === selectedTruck?.truckId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Truck</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {order && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700}>{order.ticketNumber}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {order.customerName} -- {order.jobSiteName}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {order.mixDesignName} -- {order.volume} yd{'\u00b3'} -- Requested: {dayjs(order.requestedTime).format('h:mm A')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="caption" fontWeight={600}>
                Target:
              </Typography>
              <TimePicker
                value={targetTime}
                onChange={(val) => { if (val) setTargetTime(val); }}
                minutesStep={15}
                slotProps={{
                  textField: {
                    size: 'small',
                    variant: 'standard',
                    sx: { width: 120 },
                  },
                }}
              />
            </Box>
          </Box>
        )}

        {requestedInPast && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Requested time has passed — target adjusted
          </Alert>
        )}

        {/* Late arrival warning for selected truck */}
        {selectedAvailability?.lateByMinutes != null && selectedAvailability.lateByMinutes > 0 && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            Truck will be available ~{selectedAvailability.lateByMinutes} min after target time
          </Alert>
        )}

        {/* All trucks sorted by availability */}
        <List dense>
          {truckAvailability.map(({ truck, isAvailableNow, availableAt, lateByMinutes, dailyOrderCount }) => {
            const statusColor = truckStatusColors[truck.currentStatus as TruckStatus];

            return (
              <ListItemButton
                key={truck.truckId}
                selected={selectedTruck?.truckId === truck.truckId}
                onClick={() => setSelectedTruck(truck)}
                sx={{
                  borderRadius: 1,
                  opacity: isAvailableNow ? 1 : 0.8,
                  mb: 0.5,
                }}
              >
                <ListItemIcon>
                  <LocalShippingIcon
                    sx={{ color: isAvailableNow ? 'success.main' : (statusColor?.text ?? 'text.disabled') }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>Truck {truck.truckNumber}</span>
                      {dailyOrderCount > 0 && (
                        <Chip
                          label={`${dailyOrderCount} today`}
                          size="small"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      )}
                      {lateByMinutes != null && lateByMinutes > 0 && (
                        <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box component="span">
                      {truck.driver.name} -- {truck.capacity} yd{'\u00b3'}
                      {isAvailableNow ? (
                        <Chip
                          label="Available now"
                          size="small"
                          sx={{
                            ml: 1,
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: 'success.light',
                            color: 'success.contrastText',
                          }}
                        />
                      ) : availableAt ? (
                        <Chip
                          label={`Available ${dayjs(availableAt).format('h:mm A')}`}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: statusColor?.background,
                            color: statusColor?.text,
                          }}
                        />
                      ) : (
                        <Chip
                          label={statusColor?.label ?? truck.currentStatus}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: statusColor?.background,
                            color: statusColor?.text,
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>

        {truckAvailability.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 2, textAlign: 'center' }}>
            No trucks found for this plant.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={!selectedTruck || submitting}
        >
          {submitting ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
