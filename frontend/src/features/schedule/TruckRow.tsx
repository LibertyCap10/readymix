/**
 * TruckRow — one horizontal row in the Gantt chart representing a truck's daily schedule.
 *
 * Left column: truck number + driver name (fixed width).
 * Right column: positioned ScheduleBlock components + background grid lines.
 */

import { Box, Typography, Chip } from '@mui/material';
import type { TruckDaySchedule } from '@/types/domain';
import { ScheduleBlock } from './ScheduleBlock';
import { TOTAL_WIDTH, LABEL_WIDTH, PX_PER_MINUTE } from './TimeAxis';
import dayjs from 'dayjs';

const ROW_HEIGHT = 52;

interface TruckRowProps {
  schedule: TruckDaySchedule;
  date: string;
  onBlockClick?: (ticketNumber: string) => void;
  onGapClick?: (truckId: string, gapStart: string, gapEnd: string) => void;
}

export function TruckRow({ schedule, date, onBlockClick, onGapClick }: TruckRowProps) {

  // Render 30-min grid lines in the background
  const gridLines: number[] = [];
  for (let m = 0; m <= 900; m += 30) {
    gridLines.push(m * PX_PER_MINUTE);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: ROW_HEIGHT,
        borderBottom: 1,
        borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Label column */}
      <Box
        sx={{
          minWidth: LABEL_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1.5,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          left: 0,
          zIndex: 5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
            #{schedule.truckNumber}
          </Typography>
          {schedule.blocks.length > 0 && (
            <Chip
              label={`${schedule.blocks.length}`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap>
          {schedule.driverName}
        </Typography>
        {schedule.nextAvailableAt && (
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
            Next: {dayjs(schedule.nextAvailableAt).format('h:mm A')}
          </Typography>
        )}
      </Box>

      {/* Timeline area */}
      <Box sx={{ position: 'relative', width: TOTAL_WIDTH, minHeight: ROW_HEIGHT }}>
        {/* Background grid lines */}
        {gridLines.map((px) => (
          <Box
            key={px}
            sx={{
              position: 'absolute',
              left: px,
              top: 0,
              bottom: 0,
              borderLeft: '1px solid',
              borderColor: 'divider',
              opacity: 0.4,
            }}
          />
        ))}

        {/* Schedule blocks */}
        {schedule.blocks.map((block) => (
          <ScheduleBlock
            key={block.ticketNumber}
            block={block}
            date={date}
            onClick={onBlockClick}
          />
        ))}

        {/* Clickable gaps between blocks */}
        {schedule.blocks.length > 0 && renderGaps(schedule, date, onGapClick)}
      </Box>
    </Box>
  );
}

function renderGaps(
  schedule: TruckDaySchedule,
  date: string,
  onGapClick?: (truckId: string, gapStart: string, gapEnd: string) => void,
) {
  const gaps: React.ReactNode[] = [];
  const blocks = schedule.blocks;

  for (let i = 0; i < blocks.length - 1; i++) {
    const gapStart = blocks[i].returnArrivalAt;
    const gapEnd = blocks[i + 1].scheduledDepartureAt;
    const gapMs = dayjs(gapEnd).diff(dayjs(gapStart), 'minute');

    if (gapMs > 20) {
      // Only render clickable gaps if there's meaningful space
      const left = dayjs(gapStart).diff(dayjs(date).hour(5), 'minute', true) * PX_PER_MINUTE;
      const width = gapMs * PX_PER_MINUTE;

      gaps.push(
        <Box
          key={`gap-${i}`}
          onClick={() => onGapClick?.(schedule.truckId, gapStart, gapEnd)}
          sx={{
            position: 'absolute',
            left,
            width,
            top: 8,
            bottom: 8,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.5,
            transition: 'opacity 0.15s',
            '&:hover': {
              opacity: 1,
              bgcolor: 'action.hover',
            },
          }}
        >
          {width > 40 && (
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
              +
            </Typography>
          )}
        </Box>,
      );
    }
  }

  return gaps;
}
