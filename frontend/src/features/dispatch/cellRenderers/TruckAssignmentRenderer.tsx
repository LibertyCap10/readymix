/**
 * TruckAssignmentRenderer — shows the assigned truck number + driver name,
 * or an "Unassigned" placeholder when no truck has been dispatched yet.
 */

import type { CustomCellRendererProps } from 'ag-grid-react';
import { Box, Typography, Chip } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import type { Order } from '@/types/domain';

export function TruckAssignmentRenderer(props: CustomCellRendererProps<Order>) {
  const order = props.data;
  if (!order) return null;

  if (!order.assignedTruckNumber) {
    return (
      <Chip
        label="Unassigned"
        size="small"
        variant="outlined"
        sx={{ color: 'text.disabled', borderColor: 'divider', fontSize: 11 }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, lineHeight: 1 }}>
      <LocalShippingIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.2 }}>
          #{order.assignedTruckNumber}
        </Typography>
        {order.driverName && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}>
            {order.driverName}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
