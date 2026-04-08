/**
 * FleetPage.test.tsx
 *
 * Integration test for the fleet dashboard. We mock the data hooks (useFleet,
 * useAnalytics) and the chart/grid libraries so tests focus on:
 *   - The page header renders plant name and truck count summary
 *   - The live-update countdown badge is present
 *   - All three chart cards render their titles
 *   - The Truck Roster section renders
 *
 * The hooks are mocked at the module level so no real timers or mock data
 * imports are needed in the test.
 */

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { PlantProvider } from '@/context/PlantContext';
import { FleetPage } from './FleetPage';

// ── Mock data hooks ───────────────────────────────────────────────────────────

jest.mock('@/hooks/useFleet', () => ({
  useFleet: () => ({
    trucks: [
      {
        truckId: 'TRUCK-101', truckNumber: '101', plantId: 'PLANT-001',
        type: 'rear_discharge', capacity: 10, year: 2022, make: 'Kenworth',
        model: 'T880', vin: '1NKWL70X42J123456',
        driver: { driverId: 'DRV-001', name: 'Jesse Ramirez',
                  phone: '(512) 555-1101', certifications: ['cdl_class_b'] },
        currentStatus: 'in_transit', lastWashout: '2026-03-31T06:30:00Z',
        loadsToday: 2,
      },
      {
        truckId: 'TRUCK-102', truckNumber: '102', plantId: 'PLANT-001',
        type: 'rear_discharge', capacity: 10, year: 2021, make: 'Peterbilt',
        model: '567', vin: '2XPWD49X71M789012',
        driver: { driverId: 'DRV-002', name: 'Maria Santos',
                  phone: '(512) 555-1102', certifications: ['cdl_class_b'] },
        currentStatus: 'maintenance', lastWashout: '2026-03-30T16:00:00Z',
        loadsToday: 0,
      },
    ],
    statusCounts: {
      available: 0, loading: 0, in_transit: 1,
      pouring: 0,   returning: 0, maintenance: 1,
    },
    secondsUntilNext: 7,
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    cycleTimePoints: [
      { label: 'Mar 25', avgMinutes: 88 },
      { label: 'Mar 26', avgMinutes: 92 },
    ],
    utilizationSegments: [
      { category: 'Productive',  hours: 137, color: '#37474F' },
      { category: 'Idle',        hours: 38,  color: '#FF6D00' },
      { category: 'Maintenance', hours: 25,  color: '#C62828' },
    ],
    utilizationPct: 68,
    utilization: { productiveHours: 137, idleHours: 38, maintenanceHours: 25 },
    loading: false,
    error: null,
  }),
}));

// ── Mock chart / grid libraries ───────────────────────────────────────────────

jest.mock('ag-charts-react', () => ({
  AgCharts: () => <div data-testid="ag-charts-mock" />,
}));

jest.mock('ag-grid-react', () => ({
  AgGridReact: () => <div data-testid="ag-grid-mock" />,
}));

// ── Render helper ─────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <PlantProvider>
        <FleetPage />
      </PlantProvider>
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FleetPage', () => {
  test('renders plant name in header', () => {
    renderPage();
    // plants[0] is 'Riverside Batch Plant' — the default selected plant
    expect(screen.getByText(/Riverside Batch Plant/i)).toBeInTheDocument();
  });

  test('renders truck count summary', () => {
    renderPage();
    // 2 total trucks, 1 active (non-maintenance)
    expect(screen.getByText(/2 trucks/i)).toBeInTheDocument();
    expect(screen.getByText(/1 active/i)).toBeInTheDocument();
  });

  test('renders maintenance count when trucks are in maintenance', () => {
    renderPage();
    expect(screen.getByText(/1 in maintenance/i)).toBeInTheDocument();
  });

  test('shows the live countdown badge', () => {
    renderPage();
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.getByText(/next update in 7s/i)).toBeInTheDocument();
  });

  test('renders all three chart card titles', () => {
    renderPage();
    expect(screen.getByText('Fleet Status')).toBeInTheDocument();
    expect(screen.getByText('Avg Cycle Time')).toBeInTheDocument();
    expect(screen.getByText('Fleet Utilization')).toBeInTheDocument();
  });

  test('renders the Truck Roster section header', () => {
    renderPage();
    expect(screen.getByText('Truck Roster')).toBeInTheDocument();
  });

  test('renders three chart instances', () => {
    renderPage();
    expect(screen.getAllByTestId('ag-charts-mock')).toHaveLength(3);
  });

  test('renders one grid instance (Truck Roster)', () => {
    renderPage();
    expect(screen.getAllByTestId('ag-grid-mock')).toHaveLength(1);
  });
});
