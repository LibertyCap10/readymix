import dayjs from 'dayjs';
import type { Order } from '@/types/domain';

interface OrderDisplayTime {
  time: string;   // formatted "h:mm A"
  label: string;  // "Target" | "Scheduled" | "Requested"
  iso: string;    // raw ISO string for comparisons
}

export function getOrderDisplayTime(order: Pick<Order, 'status' | 'targetTime' | 'requestedTime' | 'timeline'>): OrderDisplayTime {
  if (order.status === 'pending') {
    const iso = order.targetTime ?? order.requestedTime;
    return { time: dayjs(iso).format('h:mm A'), label: 'Target', iso };
  }

  if (order.status === 'scheduled' && order.timeline?.scheduledDepartureAt) {
    const iso = order.timeline.scheduledDepartureAt;
    return { time: dayjs(iso).format('h:mm A'), label: 'Scheduled', iso };
  }

  return { time: dayjs(order.requestedTime).format('h:mm A'), label: 'Requested', iso: order.requestedTime };
}
