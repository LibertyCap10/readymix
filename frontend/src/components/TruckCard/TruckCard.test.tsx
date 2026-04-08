import { render, screen, fireEvent } from '@testing-library/react';
import TruckCard from './TruckCard';
import type { Truck } from '../../mocks/types';

const mockTruck: Truck = {
  truckId: 'TRUCK-101',
  truckNumber: '101',
  plantId: 'PLANT-001',
  type: 'rear_discharge',
  capacity: 10,
  year: 2022,
  make: 'Kenworth',
  model: 'T880',
  vin: '1NKWL70X42J123456',
  driver: {
    driverId: 'DRV-001',
    name: 'Jesse Ramirez',
    phone: '(512) 555-1101',
    certifications: ['cdl_class_b'],
  },
  currentStatus: 'in_transit',
  currentJobSite: 'Lakewood Estates Phase 2',
  currentOrderId: 'TKT-2026-0001',
  lastWashout: '2026-03-31T06:30:00Z',
  loadsToday: 2,
};

describe('TruckCard', () => {
  it('renders truck number and driver name', () => {
    render(<TruckCard truck={mockTruck} />);
    expect(screen.getByText('Truck 101')).toBeInTheDocument();
    expect(screen.getByText('Jesse Ramirez')).toBeInTheDocument();
  });

  it('renders the status chip', () => {
    render(<TruckCard truck={mockTruck} />);
    expect(screen.getByText('In Transit')).toBeInTheDocument();
  });

  it('renders the current job site when present', () => {
    render(<TruckCard truck={mockTruck} />);
    expect(screen.getByText('Lakewood Estates Phase 2')).toBeInTheDocument();
  });

  it('does not render job site when not assigned', () => {
    const availableTruck: Truck = {
      ...mockTruck,
      currentStatus: 'available',
      currentJobSite: undefined,
    };
    render(<TruckCard truck={availableTruck} />);
    expect(screen.queryByText('Lakewood Estates Phase 2')).not.toBeInTheDocument();
  });

  it('renders loads today', () => {
    render(<TruckCard truck={mockTruck} />);
    expect(screen.getByText('2 loads today')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<TruckCard truck={mockTruck} onClick={handleClick} />);
    fireEvent.click(screen.getByText('Truck 101'));
    expect(handleClick).toHaveBeenCalledWith(mockTruck);
  });
});
