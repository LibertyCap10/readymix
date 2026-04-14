/**
 * TimeCellRenderer — shows a contextual time based on order status:
 *   Pending   → target dispatch time (labeled "Tgt")
 *   Scheduled → scheduled departure time (labeled "Sched")
 *   Other     → requested time (no label prefix)
 * Overdue times turn orange.
 */

import type { CustomCellRendererProps } from 'ag-grid-react';
import { Typography } from '@mui/material';
import dayjs from 'dayjs';
import { getOrderDisplayTime } from '@/utils/orderTime';

export function TimeCellRenderer(props: CustomCellRendererProps) {
  const order = props.data;
  if (!order?.requestedTime) return <Typography variant="body2" color="text.disabled">—</Typography>;

  const { time, label, iso } = getOrderDisplayTime(order);
  const isOverdue = dayjs(iso).isBefore(dayjs()) && !['complete', 'cancelled'].includes(order.status ?? '');

  const prefix = label === 'Target' ? 'Tgt ' : label === 'Scheduled' ? 'Sched ' : '';

  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 500,
        color: isOverdue ? 'warning.main' : 'text.primary',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {prefix && (
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
          {prefix}
        </Typography>
      )}
      {time}
    </Typography>
  );
}
