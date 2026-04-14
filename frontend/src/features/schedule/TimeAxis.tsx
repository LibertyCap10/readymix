/**
 * TimeAxis — horizontal time ruler for the Gantt schedule view.
 *
 * Renders tick marks from the configured day start to day end,
 * with labels every 30 minutes. Sticky-positioned at top during scroll.
 */

import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';

export const DAY_START_HOUR = 5;  // 5:00 AM
export const DAY_END_HOUR = 20;   // 8:00 PM
export const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60; // 900 minutes
export const PX_PER_MINUTE = 3;
export const TOTAL_WIDTH = TOTAL_MINUTES * PX_PER_MINUTE; // 2700px
export const LABEL_WIDTH = 160;   // left label column width

/** Convert an ISO timestamp to pixel offset from the left edge of the timeline */
export function timeToPixel(isoTime: string, date: string): number {
  const d = dayjs(isoTime);
  const dayStart = dayjs(date).hour(DAY_START_HOUR).minute(0).second(0);
  const minutesFromStart = d.diff(dayStart, 'minute', true);
  return Math.max(0, minutesFromStart * PX_PER_MINUTE);
}

export function TimeAxis({ date }: { date: string }) {
  const ticks: { label: string; offset: number }[] = [];
  const dayStart = dayjs(date).hour(DAY_START_HOUR).minute(0);

  for (let m = 0; m <= TOTAL_MINUTES; m += 30) {
    const t = dayStart.add(m, 'minute');
    ticks.push({
      label: t.format('h:mm A'),
      offset: m * PX_PER_MINUTE,
    });
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        minHeight: 32,
      }}
    >
      {/* Label column spacer */}
      <Box sx={{ minWidth: LABEL_WIDTH, flexShrink: 0 }} />

      {/* Time ticks */}
      <Box sx={{ position: 'relative', width: TOTAL_WIDTH, minHeight: 32 }}>
        {ticks.map((tick) => (
          <Box
            key={tick.offset}
            sx={{
              position: 'absolute',
              left: tick.offset,
              top: 0,
              bottom: 0,
              borderLeft: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: 4,
                top: 4,
                whiteSpace: 'nowrap',
                fontSize: '0.65rem',
                color: 'text.secondary',
                userSelect: 'none',
              }}
            >
              {tick.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
