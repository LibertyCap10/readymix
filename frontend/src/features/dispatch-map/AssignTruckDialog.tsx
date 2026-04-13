/**
 * AssignTruckDialog — dialog for assigning or reassigning a truck to an order.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import type { Order, Truck } from '@/types/domain';

interface AssignTruckDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  availableTrucks: Truck[];
  onAssign: (ticketNumber: string, truckId: string, truckNumber: string, driverName: string) => Promise<void>;
}

export function AssignTruckDialog({
  open,
  onClose,
  order,
  availableTrucks,
  onAssign,
}: AssignTruckDialogProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        {availableTrucks.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No trucks available for assignment.
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
                  <LocalShippingIcon />
                </ListItemIcon>
                <ListItemText
                  primary={`Truck ${truck.truckNumber}`}
                  secondary={`${truck.driver.name} -- ${truck.capacity} yd\u00b3 capacity`}
                />
              </ListItemButton>
            ))}
          </List>
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
