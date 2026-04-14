import { useState, useEffect } from 'react';
import { Typography } from '@mui/material';

export function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Typography
      variant="body2"
      sx={{
        fontFamily: 'monospace',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        fontSize: { xs: '0.7rem', md: '0.8rem' },
        whiteSpace: 'nowrap',
        letterSpacing: '0.5px',
        mr: 2,
      }}
    >
      {now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}
    </Typography>
  );
}
