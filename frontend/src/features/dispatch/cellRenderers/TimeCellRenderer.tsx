/**
 * TimeCellRenderer — formats an ISO datetime string as "h:mm A" (e.g. "7:30 AM").
 * Shows the time in bold; if the delivery is overdue the time turns orange.
 */

import type { CustomCellRendererProps } from 'ag-grid-react';
import { Typography } from '@mui/material';
import dayjs from 'dayjs';

export function TimeCellRenderer(props: CustomCellRendererProps) {
  const iso = props.value as string;
  if (!iso) return <Typography variant="body2" color="text.disabled">—</Typography>;

  const dt = dayjs(iso);
  const formatted = dt.format('h:mm A');
  const isOverdue = dt.isBefore(dayjs()) && !['complete', 'cancelled'].includes(props.data?.status ?? '');

  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 500,
        color: isOverdue ? 'warning.main' : 'text.primary',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatted}
    </Typography>
  );
}
