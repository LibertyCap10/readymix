/**
 * UtilizationChart.test.tsx
 *
 * Tests the donut chart component's branching logic. The chart itself is mocked
 * since AG Charts requires canvas. We verify:
 *   - Empty state when all hours are zero
 *   - Empty state when segments array is empty
 *   - Chart renders with real utilization data
 */

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { UtilizationChart } from './UtilizationChart';
import type { UtilizationSegment } from '@/hooks/useAnalytics';

// ── Mock ag-charts-react ─────────────────────────────────────────────────────
jest.mock('ag-charts-react', () => ({
  AgCharts: () => <div data-testid="ag-charts-mock" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCTIVE_SEGMENTS: UtilizationSegment[] = [
  { category: 'Productive',  hours: 137, color: '#37474F' },
  { category: 'Idle',        hours: 38,  color: '#FF6D00' },
  { category: 'Maintenance', hours: 25,  color: '#C62828' },
];

const ZERO_SEGMENTS: UtilizationSegment[] = [
  { category: 'Productive',  hours: 0, color: '#37474F' },
  { category: 'Idle',        hours: 0, color: '#FF6D00' },
  { category: 'Maintenance', hours: 0, color: '#C62828' },
];

function renderChart(segments: UtilizationSegment[], utilizationPct = 68) {
  return render(
    <ThemeProvider theme={theme}>
      <UtilizationChart segments={segments} utilizationPct={utilizationPct} />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UtilizationChart', () => {
  test('shows empty-state message when segment array is empty', () => {
    renderChart([], 0);
    expect(screen.getByText(/no utilization data/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ag-charts-mock')).not.toBeInTheDocument();
  });

  test('shows empty-state message when all hours are zero', () => {
    renderChart(ZERO_SEGMENTS, 0);
    expect(screen.getByText(/no utilization data/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ag-charts-mock')).not.toBeInTheDocument();
  });

  test('renders the chart when at least one segment has hours', () => {
    renderChart(PRODUCTIVE_SEGMENTS, 68);
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
    expect(screen.queryByText(/no utilization data/i)).not.toBeInTheDocument();
  });

  test('renders chart when only one segment has hours', () => {
    const oneSegment: UtilizationSegment[] = [
      { category: 'Productive',  hours: 40, color: '#37474F' },
      { category: 'Idle',        hours: 0,  color: '#FF6D00' },
      { category: 'Maintenance', hours: 0,  color: '#C62828' },
    ];
    renderChart(oneSegment, 100);
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
  });
});
