/**
 * ScheduleBlock — a single order rendered as a horizontal bar on the Gantt.
 *
 * Four color-coded segments: Loading | Transit Out | Pouring | Transit Return.
 * Positioned absolutely via timeToPixel.
 */

import { Box, Tooltip, Typography } from '@mui/material';
import { LocalFireDepartment } from '@mui/icons-material';
import type { TruckScheduleBlock } from '@/types/domain';
import { orderStatusColors } from '@/theme/statusColors';
import { timeToPixel } from './TimeAxis';
import dayjs from 'dayjs';

// Phase colors — using the truck status palette for visual consistency
const PHASE_COLORS = {
  loading:   { bg: '#FFF8E1', border: '#F57F17' },  // amber (loading)
  transit:   { bg: '#E8EAF6', border: '#283593' },  // indigo (in_transit)
  pouring:   { bg: '#FBE9E7', border: '#D84315' },  // deep orange (pouring)
  returning: { bg: '#E0F2F1', border: '#00695C' },  // teal (returning)
};

interface ScheduleBlockProps {
  block: TruckScheduleBlock;
  date: string;
  onClick?: (ticketNumber: string) => void;
}

export function ScheduleBlock({ block, date, onClick }: ScheduleBlockProps) {
  const leftPx = timeToPixel(block.scheduledDepartureAt, date);
  const rightPx = timeToPixel(block.returnArrivalAt, date);
  const totalWidth = Math.max(rightPx - leftPx, 8); // minimum 8px

  // Compute phase widths as fractions of total
  const depMs  = dayjs(block.scheduledDepartureAt).valueOf();
  const loadMs = dayjs(block.loadingCompletesAt).valueOf();
  const arrMs  = dayjs(block.transitArrivalAt).valueOf();
  const pourMs = dayjs(block.pourCompletesAt).valueOf();
  const retMs  = dayjs(block.returnArrivalAt).valueOf();
  const totalMs = retMs - depMs || 1;

  const loadFrac    = (loadMs - depMs) / totalMs;
  const transitFrac = (arrMs - loadMs) / totalMs;
  const pourFrac    = (pourMs - arrMs) / totalMs;
  const returnFrac  = (retMs - pourMs) / totalMs;

  const statusColor = orderStatusColors[block.status];

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2">{block.ticketNumber}</Typography>
      <Typography variant="caption" display="block">{block.customerName}</Typography>
      <Typography variant="caption" display="block">{block.jobSiteName}</Typography>
      <Typography variant="caption" display="block">{block.volume} yd³ — {block.pourType}</Typography>
      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
        Depart: {dayjs(block.scheduledDepartureAt).format('h:mm A')}
      </Typography>
      <Typography variant="caption" display="block">
        Arrive: {dayjs(block.transitArrivalAt).format('h:mm A')}
      </Typography>
      <Typography variant="caption" display="block">
        Pour done: {dayjs(block.pourCompletesAt).format('h:mm A')}
      </Typography>
      <Typography variant="caption" display="block">
        Return: {dayjs(block.returnArrivalAt).format('h:mm A')}
      </Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} placement="top" arrow>
      <Box
        onClick={() => onClick?.(block.ticketNumber)}
        sx={{
          position: 'absolute',
          left: leftPx,
          width: totalWidth,
          top: 4,
          bottom: 4,
          display: 'flex',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'pointer',
          border: `1px solid ${statusColor.text}`,
          transition: 'box-shadow 0.15s',
          '&:hover': {
            boxShadow: 3,
            zIndex: 5,
          },
        }}
      >
        {/* Loading phase */}
        <Box sx={{ width: `${loadFrac * 100}%`, bgcolor: PHASE_COLORS.loading.bg, minWidth: 1 }} />
        {/* Transit out */}
        <Box sx={{ width: `${transitFrac * 100}%`, bgcolor: PHASE_COLORS.transit.bg, minWidth: 1 }} />
        {/* Pouring */}
        <Box sx={{ width: `${pourFrac * 100}%`, bgcolor: PHASE_COLORS.pouring.bg, minWidth: 1 }} />
        {/* Return trip */}
        <Box sx={{ width: `${returnFrac * 100}%`, bgcolor: PHASE_COLORS.returning.bg, minWidth: 1 }} />

        {/* Ticket label overlay */}
        {totalWidth > 60 && (
          <Box
            sx={{
              position: 'absolute',
              left: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              pointerEvents: 'none',
            }}
          >
            {block.isHotLoad && (
              <LocalFireDepartment sx={{ fontSize: 12, color: '#D84315' }} />
            )}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: 'text.primary',
                textShadow: '0 0 3px rgba(255,255,255,0.9)',
                whiteSpace: 'nowrap',
              }}
            >
              {block.ticketNumber}
            </Typography>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}
