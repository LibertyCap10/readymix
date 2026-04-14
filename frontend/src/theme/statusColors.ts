export type OrderStatus =
  | 'pending'
  | 'scheduled'
  | 'dispatched'
  | 'in_transit'
  | 'pouring'
  | 'returning'
  | 'complete'
  | 'cancelled';

export type TruckStatus =
  | 'available'
  | 'scheduled'
  | 'loading'
  | 'in_transit'
  | 'pouring'
  | 'returning'
  | 'maintenance';

export interface StatusColor {
  background: string;
  text: string;
  label: string;
}

export const orderStatusColors: Record<OrderStatus, StatusColor> = {
  pending: { background: '#FFF8E1', text: '#F57F17', label: 'Pending' },
  scheduled: { background: '#EDE7F6', text: '#4527A0', label: 'Scheduled' },
  dispatched: { background: '#E3F2FD', text: '#1565C0', label: 'Dispatched' },
  in_transit: { background: '#E8EAF6', text: '#283593', label: 'In Transit' },
  pouring: { background: '#FBE9E7', text: '#D84315', label: 'Pouring' },
  returning: { background: '#E0F2F1', text: '#00695C', label: 'Returning' },
  complete: { background: '#E8F5E9', text: '#2E7D32', label: 'Complete' },
  cancelled: { background: '#FFEBEE', text: '#C62828', label: 'Cancelled' },
};

export const truckStatusColors: Record<TruckStatus, StatusColor> = {
  available: { background: '#E8F5E9', text: '#2E7D32', label: 'Available' },
  scheduled: { background: '#EDE7F6', text: '#4527A0', label: 'Scheduled' },
  loading: { background: '#FFF8E1', text: '#F57F17', label: 'Loading' },
  in_transit: { background: '#E8EAF6', text: '#283593', label: 'In Transit' },
  pouring: { background: '#FBE9E7', text: '#D84315', label: 'Pouring' },
  returning: { background: '#E0F2F1', text: '#00695C', label: 'Returning' },
  maintenance: { background: '#F3E5F5', text: '#6A1B9A', label: 'Maintenance' },
};
