/**
 * AssignTruckDialog — dialog for assigning or reassigning a truck to an order.
 *
 * Shows available trucks (selectable) and busy trucks (grayed out with status).
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { truckStatusColors } from '@/theme/statusColors';
import type { TruckStatus } from '@/theme/statusColors';
import type { Order, Truck } from '@/types/domain';

interface AssignTruckDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  availableTrucks: Truck[];
  allTrucks: Truck[];
  onAssign: (ticketNumber: string, truckId: string, truckNumber: string, driverName: string) => Promise<void>;
}

export function AssignTruckDialog({
  open,
  onClose,
  order,
  availableTrucks,
  allTrucks,
  onAssign,
}: AssignTruckDialogProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busyTrucks = useMemo(
    () => allTrucks.filter(t => t.currentStatus !== 'available'),
    [allTrucks],
  );

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
      );
      setSelectedTruck(null);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to assign truck');
    } finally {
      setSubmitting(false);
    }
  };

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
            <Typography variant="caption" color="text.secondary">
              {order.mixDesignName} -- {order.volume} yd{'\u00b3'}
            </Typography>
          </Box>
        )}

        {/* Available trucks — selectable */}
        <Typography variant="overline" color="success.main" sx={{ fontWeight: 700 }}>
          Available ({availableTrucks.length})
        </Typography>

        {availableTrucks.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1, pl: 1 }}>
            No trucks available right now.
          </Typography>
        ) : (
          <List dense>
            {availableTrucks.map(truck => (
              <ListItemButton
                key={truck.truckId}
                selected={selectedTruck?.truckId === truck.truckId}
                onClick={() => setSelectedTruck(truck)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon>
                  <LocalShippingIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary={`Truck ${truck.truckNumber}`}
                  secondary={`${truck.driver.name} -- ${truck.capacity} yd\u00b3 capacity`}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {/* Busy trucks — display only */}
        {busyTrucks.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Busy ({busyTrucks.length})
            </Typography>
            <List dense>
              {busyTrucks.map(truck => {
                const statusColor = truckStatusColors[truck.currentStatus as TruckStatus];
                return (
                  <ListItem key={truck.truckId} sx={{ opacity: 0.55, borderRadius: 1 }}>
                    <ListItemIcon>
                      <LocalShippingIcon sx={{ color: statusColor?.text ?? 'text.disabled' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>Truck {truck.truckNumber}</span>
                          <Chip
                            label={statusColor?.label ?? truck.currentStatus}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              bgcolor: statusColor?.background,
                              color: statusColor?.text,
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        truck.currentJobSite
                          ? `${truck.driver.name} -- ${truck.currentJobSite}`
                          : truck.driver.name
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </>
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
