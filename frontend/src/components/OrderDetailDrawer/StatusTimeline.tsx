/**
 * StatusTimeline — a vertical event log showing how an order moved through
 * its lifecycle. Uses MUI's Stepper in vertical mode.
 *
 * Each DeliveryEvent becomes a Step with a timestamp and optional note.
 */

import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CancelIcon from '@mui/icons-material/Cancel';
import dayjs from 'dayjs';
import type { DeliveryEvent } from '@/types/domain';
import { orderStatusColors } from '@/theme/statusColors';
import type { OrderStatus } from '@/theme/statusColors';

interface StatusTimelineProps {
  events: DeliveryEvent[];
  currentStatus: OrderStatus;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:    'Order Created',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  pouring:    'Pouring',
  returning:  'Returning to Plant',
  complete:   'Completed',
  cancelled:  'Cancelled',
};

export function StatusTimeline({ events, currentStatus }: StatusTimelineProps) {
  if (!events.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No events recorded yet.
      </Typography>
    );
  }

  const isComplete = currentStatus === 'complete';
  const isCancelled = currentStatus === 'cancelled';

  return (
    <Stepper orientation="vertical" nonLinear sx={{ pl: 0 }}>
      {events.map((event, idx) => {
        const colors = orderStatusColors[event.eventType as OrderStatus];
        const isLast = idx === events.length - 1;

        const icon = isCancelled && isLast
          ? <CancelIcon sx={{ color: 'error.main', fontSize: 22 }} />
          : isComplete && isLast
          ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 22 }} />
          : isLast
          ? <RadioButtonUncheckedIcon sx={{ color: colors?.text ?? 'primary.main', fontSize: 22 }} />
          : <CheckCircleIcon sx={{ color: 'success.main', fontSize: 22 }} />;

        return (
          <Step key={idx} active completed={!isLast || isComplete}>
            <StepLabel
              StepIconComponent={() => (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
                  {icon}
                </Box>
              )}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {STATUS_LABELS[event.eventType as OrderStatus] ?? event.eventType}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {dayjs(event.timestamp).format('h:mm A')}
                </Typography>
              </Box>
            </StepLabel>
            {event.note && (
              <StepContent>
                <Typography variant="caption" color="text.secondary">
                  {event.note}
                </Typography>
              </StepContent>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
}
