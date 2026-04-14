/**
 * ScheduleGantt — main Gantt chart component for the daily truck schedule.
 *
 * Shows each truck as a row with time-positioned blocks representing orders.
 * Includes a time axis, now marker, phase legend, and unassigned orders sidebar.
 */

import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import type { ScheduleResponse } from '@/types/domain';
import { TimeAxis } from './TimeAxis';
import { TruckRow } from './TruckRow';
import { NowMarker } from './NowMarker';
import { UnassignedSidebar } from './UnassignedSidebar';
import { ScheduleLegend } from './ScheduleLegend';

interface ScheduleGanttProps {
  data: ScheduleResponse | null;
  loading: boolean;
  date: string;
  onBlockClick?: (ticketNumber: string) => void;
  onGapClick?: (truckId: string, gapStart: string, gapEnd: string) => void;
  onUnassignedClick?: (ticketNumber: string) => void;
}

export function ScheduleGantt({
  data,
  loading,
  date,
  onBlockClick,
  onGapClick,
  onUnassignedClick,
}: ScheduleGanttProps) {
  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <Typography color="text.secondary">No schedule data</Typography>
      </Box>
    );
  }

  const totalOrders = data.schedules.reduce((sum, s) => sum + s.blocks.length, 0);
  const totalVolume = data.schedules.reduce(
    (sum, s) => sum + s.blocks.reduce((bSum, b) => bSum + b.volume, 0), 0
  );

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main Gantt area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header with legend and summary */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2">
              {data.schedules.length} trucks
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {totalOrders} orders &middot; {totalVolume.toFixed(1)} yd³ scheduled
            </Typography>
          </Box>
          <ScheduleLegend />
        </Box>

        {/* Scrollable Gantt chart */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          {/* Now marker spans full height */}
          <NowMarker date={date} />

          {/* Time axis (sticky top) */}
          <TimeAxis date={date} />

          {/* Truck rows */}
          {data.schedules.map((schedule) => (
            <TruckRow
              key={schedule.truckId}
              schedule={schedule}
              date={date}
              onBlockClick={onBlockClick}
              onGapClick={onGapClick}
            />
          ))}

          {data.schedules.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No trucks available</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Unassigned orders sidebar */}
      <Paper
        variant="outlined"
        sx={{
          width: 240,
          flexShrink: 0,
          overflow: 'auto',
          borderLeft: 1,
          borderColor: 'divider',
          borderRadius: 0,
        }}
      >
        <UnassignedSidebar
          orders={data.unassignedOrders}
          onOrderClick={onUnassignedClick}
        />
      </Paper>
    </Box>
  );
}
