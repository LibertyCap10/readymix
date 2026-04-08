/**
 * TruckRoster.test.tsx
 *
 * AG Grid renders into a virtual DOM that jsdom doesn't fully support, so we
 * mock AgGridReact and focus on:
 *   - Empty state when no trucks are passed
 *   - The component renders without errors when trucks are passed
 *
 * Grid internals (sorting, cell renderers) are exercised by Storybook stories
 * and manual browser testing — not unit tests.
 */

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { TruckRoster } from './TruckRoster';
import type { Truck } from '@/mocks/types';

// ── Mock ag-grid-react ────────────────────────────────────────────────────────
jest.mock('ag-grid-react', () => ({
  AgGridReact: ({ rowData }: { rowData: unknown[] }) => (
    <div
      data-testid="ag-grid-mock"
      data-row-count={rowData?.length ?? 0}
    />
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTruck(overrides: Partial<Truck> = {}): Truck {
  return {
    truckId:       'TRUCK-101',
    truckNumber:   '101',
    plantId:       'PLANT-001',
    type:          'rear_discharge',
    capacity:      10,
    year:          2022,
    make:          'Kenworth',
    model:         'T880',
    vin:           '1NKWL70X42J123456',
    driver: {
      driverId:        'DRV-001',
      name:            'Jesse Ramirez',
      phone:           '(512) 555-1101',
      certifications:  ['cdl_class_b', 'osha_10'],
    },
    currentStatus:  'available',
    lastWashout:    '2026-03-31T06:30:00Z',
    loadsToday:     2,
    ...overrides,
  };
}

function renderRoster(trucks: Truck[]) {
  return render(
    <ThemeProvider theme={theme}>
      <TruckRoster trucks={trucks} />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TruckRoster', () => {
  test('shows empty-state message when no trucks are provided', () => {
    renderRoster([]);
    expect(screen.getByText(/no trucks registered/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ag-grid-mock')).not.toBeInTheDocument();
  });

  test('renders the grid when trucks are provided', () => {
    renderRoster([makeTruck()]);
    expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument();
    expect(screen.queryByText(/no trucks registered/i)).not.toBeInTheDocument();
  });

  test('passes all trucks as rowData', () => {
    const trucks = [
      makeTruck({ truckId: 'TRUCK-101', truckNumber: '101' }),
      makeTruck({ truckId: 'TRUCK-102', truckNumber: '102' }),
      makeTruck({ truckId: 'TRUCK-103', truckNumber: '103' }),
    ];
    renderRoster(trucks);
    const grid = screen.getByTestId('ag-grid-mock');
    expect(grid).toHaveAttribute('data-row-count', '3');
  });

  test('renders maintenance trucks without crashing', () => {
    renderRoster([makeTruck({ currentStatus: 'maintenance', loadsToday: 0 })]);
    expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument();
  });
});
