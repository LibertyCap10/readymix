/**
 * ScheduleLegend — compact legend for the Gantt chart phase colors.
 */

import { Box, Typography } from '@mui/material';

const PHASES = [
  { label: 'Loading', bg: '#FFF8E1', border: '#F57F17' },
  { label: 'Transit', bg: '#E8EAF6', border: '#283593' },
  { label: 'Pouring', bg: '#FBE9E7', border: '#D84315' },
  { label: 'Return', bg: '#E0F2F1', border: '#00695C' },
];

export function ScheduleLegend() {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', px: 1 }}>
      {PHASES.map((phase) => (
        <Box key={phase.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 10,
              bgcolor: phase.bg,
              border: `1px solid ${phase.border}`,
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            {phase.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
