import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import type { Order } from '@/mocks/types';

const SAMPLE_ORDER: Order = {
  ticketNumber:   'TKT-001',
  plantId:        'PLANT-001',
  customerId:     'CUST-001',
  customerName:   'Meridian Construction',
  jobSiteId:      'SITE-001',
  jobSiteName:    'Eastside Tower',
  jobSiteAddress: '900 E 6th St, Austin, TX',
  mixDesignId:    'MIX-4000-LS',
  mixDesignName:  '4000 PSI Limestone',
  psi:            4000,
  volume:         6.5,
  slump:          4,
  pourType:       'foundation',
  requestedTime:  '2026-03-31T09:30:00.000Z',
  assignedTruckNumber: '101',
  driverName:     'Jesse Ramirez',
  status:         'in_transit',
  isHotLoad:      false,
  notes:          'Use the south gate.',
  events: [
    { timestamp: '2026-03-31T08:00:00.000Z', eventType: 'pending',    note: 'Order created' },
    { timestamp: '2026-03-31T08:15:00.000Z', eventType: 'dispatched', note: 'Truck 101 assigned' },
    { timestamp: '2026-03-31T08:45:00.000Z', eventType: 'in_transit', note: 'Departed plant' },
  ],
  createdAt: '2026-03-31T08:00:00.000Z',
  updatedAt: '2026-03-31T08:45:00.000Z',
};

function renderDrawer(order: Order | null = SAMPLE_ORDER, open = true, onClose = jest.fn()) {
  return render(
    <ThemeProvider theme={theme}>
      <OrderDetailDrawer order={order} open={open} onClose={onClose} />
    </ThemeProvider>
  );
}

describe('OrderDetailDrawer', () => {
  test('shows ticket number in header', () => {
    renderDrawer();
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
  });

  test('shows customer name', () => {
    renderDrawer();
    expect(screen.getByText('Meridian Construction')).toBeInTheDocument();
  });

  test('shows job site name', () => {
    renderDrawer();
    expect(screen.getByText('Eastside Tower')).toBeInTheDocument();
  });

  test('shows volume', () => {
    renderDrawer();
    expect(screen.getByText(/6\.5 yd³/)).toBeInTheDocument();
  });

  test('shows slump', () => {
    renderDrawer();
    // The slump value "4"" appears in two places: as the standalone value row
    // and inside the mix design caption. Use getAllByText and confirm at least
    // one is in the document.
    expect(screen.getAllByText(/4"/)[0]).toBeInTheDocument();
  });

  test('shows truck and driver when assigned', () => {
    renderDrawer();
    expect(screen.getByText(/truck #101/i)).toBeInTheDocument();
    expect(screen.getByText('Jesse Ramirez')).toBeInTheDocument();
  });

  test('shows driver notes', () => {
    renderDrawer();
    expect(screen.getByText('Use the south gate.')).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    renderDrawer(SAMPLE_ORDER, true, onClose);
    fireEvent.click(screen.getByRole('button', { name: /close detail panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows HOT LOAD badge for hot loads', () => {
    renderDrawer({ ...SAMPLE_ORDER, isHotLoad: true });
    expect(screen.getByText('HOT LOAD')).toBeInTheDocument();
  });

  test('shows timeline events', () => {
    renderDrawer();
    expect(screen.getByText('Order Created')).toBeInTheDocument();
    expect(screen.getByText('Dispatched')).toBeInTheDocument();
  });

  test('shows "No order selected" when order is null', () => {
    renderDrawer(null);
    expect(screen.getByText(/no order selected/i)).toBeInTheDocument();
  });
});
