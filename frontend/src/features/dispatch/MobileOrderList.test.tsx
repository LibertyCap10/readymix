import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { MobileOrderList } from './MobileOrderList';
import type { Order } from '@/mocks/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    ticketNumber:   'TKT-001',
    plantId:        'PLANT-001',
    customerId:     'CUST-001',
    customerName:   'Acme Builders',
    jobSiteId:      'SITE-001',
    jobSiteName:    'North Tower',
    jobSiteAddress: '1 Main St',
    mixDesignId:    'MIX-3000-LS',
    mixDesignName:  '3000 PSI Limestone',
    psi:            3000,
    volume:         4,
    slump:          4,
    pourType:       'slab',
    requestedTime:  '2026-03-31T09:00:00.000Z',
    status:         'pending',
    isHotLoad:      false,
    events:         [],
    createdAt:      '2026-03-31T08:00:00.000Z',
    updatedAt:      '2026-03-31T08:00:00.000Z',
    ...overrides,
  };
}

function renderList(orders: Order[], onClick = jest.fn()) {
  return render(
    <ThemeProvider theme={theme}>
      <MobileOrderList orders={orders} onOrderClick={onClick} />
    </ThemeProvider>
  );
}

describe('MobileOrderList', () => {
  test('renders empty state when no orders', () => {
    renderList([]);
    expect(screen.getByText(/no orders/i)).toBeInTheDocument();
  });

  test('renders a card for each order', () => {
    renderList([makeOrder(), makeOrder({ ticketNumber: 'TKT-002', customerName: 'Beta Corp' })]);
    expect(screen.getByText('Acme Builders')).toBeInTheDocument();
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
  });

  test('shows ticket number on each card', () => {
    renderList([makeOrder()]);
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
  });

  test('calls onOrderClick when a card is clicked', () => {
    const onClick = jest.fn();
    renderList([makeOrder()], onClick);
    fireEvent.click(screen.getByText('Acme Builders'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ ticketNumber: 'TKT-001' }));
  });

  test('shows HOT chip for hot loads', () => {
    renderList([makeOrder({ isHotLoad: true })]);
    expect(screen.getByText('HOT')).toBeInTheDocument();
  });

  test('does not show HOT chip for regular loads', () => {
    renderList([makeOrder({ isHotLoad: false })]);
    expect(screen.queryByText('HOT')).not.toBeInTheDocument();
  });

  test('shows assigned truck number when present', () => {
    renderList([makeOrder({ assignedTruckNumber: '103', driverName: 'Darnell Washington' })]);
    expect(screen.getByText(/truck #103/i)).toBeInTheDocument();
  });
});
