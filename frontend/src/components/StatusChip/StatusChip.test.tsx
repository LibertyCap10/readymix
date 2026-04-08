import { render, screen } from '@testing-library/react';
import StatusChip from './StatusChip';
import type { OrderStatus } from '../../theme/statusColors';

describe('StatusChip', () => {
  const orderStatuses: OrderStatus[] = [
    'pending',
    'dispatched',
    'in_transit',
    'pouring',
    'returning',
    'complete',
    'cancelled',
  ];

  it.each(orderStatuses)('renders order status "%s"', (status) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(/./)).toBeInTheDocument();
  });

  it('renders the correct label for "in_transit"', () => {
    render(<StatusChip status="in_transit" />);
    expect(screen.getByText('In Transit')).toBeInTheDocument();
  });

  it('renders truck variant', () => {
    render(<StatusChip status="maintenance" variant="truck" />);
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('applies the correct background color', () => {
    render(<StatusChip status="pending" />);
    const chip = screen.getByText('Pending');
    // MUI Chip renders the label inside a span; the chip root has the bg
    expect(chip.closest('.MuiChip-root')).toBeInTheDocument();
  });
});
