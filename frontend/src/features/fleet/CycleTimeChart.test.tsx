/**
 * CycleTimeChart.test.tsx
 *
 * Like FleetStatusChart, AG Charts needs canvas — we mock AgCharts and test
 * the component's own branching logic:
 *   - Empty state when no data points are supplied
 *   - Renders chart when points are present
 */

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { CycleTimeChart } from './CycleTimeChart';
import type { CycleTimeChartPoint } from '@/hooks/useAnalytics';

// ── Mock ag-charts-react ─────────────────────────────────────────────────────
jest.mock('ag-charts-react', () => ({
  AgCharts: () => <div data-testid="ag-charts-mock" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_POINTS: CycleTimeChartPoint[] = [
  { label: 'Mar 25', avgMinutes: 88 },
  { label: 'Mar 26', avgMinutes: 92 },
  { label: 'Mar 27', avgMinutes: 85 },
];

function renderChart(data: CycleTimeChartPoint[]) {
  return render(
    <ThemeProvider theme={theme}>
      <CycleTimeChart data={data} />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CycleTimeChart', () => {
  test('shows empty-state message when data array is empty', () => {
    renderChart([]);
    expect(screen.getByText(/no cycle time data/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ag-charts-mock')).not.toBeInTheDocument();
  });

  test('renders the chart when data points are provided', () => {
    renderChart(SAMPLE_POINTS);
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
    expect(screen.queryByText(/no cycle time data/i)).not.toBeInTheDocument();
  });

  test('renders correctly with a single data point', () => {
    renderChart([{ label: 'Mar 25', avgMinutes: 90 }]);
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
  });

  test('renders correctly with data at the 90-min benchmark', () => {
    renderChart([{ label: 'Mar 25', avgMinutes: 90 }]);
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
  });
});
