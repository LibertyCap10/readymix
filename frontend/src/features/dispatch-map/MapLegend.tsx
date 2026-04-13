/**
 * MapLegend — collapsible legend overlay for the dispatch map.
 *
 * Shows color/icon meanings for plant, order statuses, truck statuses, and routes.
 */

import { useState } from 'react';
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlaceIcon from '@mui/icons-material/Place';
import FactoryIcon from '@mui/icons-material/Factory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { orderStatusColors, truckStatusColors } from '@/theme/statusColors';
import type { OrderStatus, TruckStatus } from '@/theme/statusColors';

const ORDER_STATUSES: OrderStatus[] = [
  'pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled',
];

const TRUCK_STATUSES: TruckStatus[] = [
  'available', 'loading', 'in_transit', 'pouring', 'returning', 'maintenance',
];

export function MapLegend() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 1,
        maxWidth: 200,
        display: { xs: 'none', sm: 'block' },
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          cursor: 'pointer',
          bgcolor: 'grey.50',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <Typography variant="caption" fontWeight={700}>
          Legend
        </Typography>
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 1.5, py: 1 }}>
          {/* Plant */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: '#37474F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FactoryIcon sx={{ color: 'white', fontSize: 8 }} />
            </Box>
            <Typography variant="caption">Plant</Typography>
          </Box>

          {/* Orders section */}
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 1, mb: 0.25 }}>
            Orders
          </Typography>
          <Stack spacing={0.25}>
            {ORDER_STATUSES.map(status => {
              const color = orderStatusColors[status];
              return (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlaceIcon sx={{ fontSize: 14, color: color.text, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ lineHeight: 1.3 }}>{color.label}</Typography>
                </Box>
              );
            })}
          </Stack>

          {/* Trucks section */}
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 1, mb: 0.25 }}>
            Trucks
          </Typography>
          <Stack spacing={0.25}>
            {TRUCK_STATUSES.map(status => {
              const color = truckStatusColors[status];
              return (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: color.text,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LocalShippingIcon sx={{ color: 'white', fontSize: 7 }} />
                  </Box>
                  <Typography variant="caption" sx={{ lineHeight: 1.3 }}>{color.label}</Typography>
                </Box>
              );
            })}
          </Stack>

          {/* Routes section */}
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 1, mb: 0.25 }}>
            Routes
          </Typography>
          <Stack spacing={0.25}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 3, bgcolor: '#1565C0', borderRadius: 1, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>Selected route</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 3, bgcolor: '#90A4AE', borderRadius: 1, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>Other routes</Typography>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
