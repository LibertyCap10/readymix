/**
 * NowMarker — red vertical line showing the current time on the Gantt chart.
 * Updates every 60 seconds.
 */

import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import { timeToPixel, LABEL_WIDTH } from './TimeAxis';

interface NowMarkerProps {
  date: string;
}

export function NowMarker({ date }: NowMarkerProps) {
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Only show for today
  if (!now.isSame(dayjs(date), 'day')) return null;

  const leftPx = timeToPixel(now.toISOString(), date) + LABEL_WIDTH;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: leftPx,
        top: 0,
        bottom: 0,
        width: 2,
        bgcolor: 'error.main',
        zIndex: 20,
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: -4,
          width: 10,
          height: 10,
          bgcolor: 'error.main',
          borderRadius: '50%',
        },
      }}
    />
  );
}
