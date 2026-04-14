/**
 * FleetStatusChart.test.tsx
 *
 * AG Charts renders to a canvas element which jsdom doesn't support. We mock
 * the AgCharts component so tests focus on the component's own logic:
 *   - Empty state when all counts are zero
 *   - Renders (doesn't crash) when real status counts are passed
 *
 * The chart option-building logic is embedded in useMemo inside the component;
 * for deeper testing of chart config, see the Storybook stories instead.
 */

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import { FleetStatusChart } from './FleetStatusChart';
import type { TruckStatus } from '@/theme/statusColors';

// ── Mock ag-charts-react (canvas not available in jsdom) ─────────────────────
jest.mock('ag-charts-react', () => ({
  AgCharts: ({ options }: { options: unknown }) => (
    <div data-testid="ag-charts-mock" data-series-count={
      (options as { series?: unknown[] })?.series?.length ?? 0
    } />
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_COUNTS: Record<TruckStatus, number> = {
  available: 0, scheduled: 0, loading: 0, in_transit: 0,
  pouring: 0,   returning: 0, maintenance: 0,
};

function makeCounts(overrides: Partial<Record<TruckStatus, number>> = {}): Record<TruckStatus, number> {
  return { ...EMPTY_COUNTS, ...overrides };
}

function renderChart(statusCounts: Record<TruckStatus, number>) {
  return render(
    <ThemeProvider theme={theme}>
      <FleetStatusChart statusCounts={statusCounts} />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FleetStatusChart', () => {
  test('shows empty-state message when all counts are zero', () => {
    renderChart(EMPTY_COUNTS);
    expect(screen.getByText(/no trucks found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ag-charts-mock')).not.toBeInTheDocument();
  });

  test('renders the chart when at least one truck is counted', () => {
    renderChart(makeCounts({ in_transit: 2, available: 1 }));
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
    expect(screen.queryByText(/no trucks found/i)).not.toBeInTheDocument();
  });

  test('renders correctly with a single truck status', () => {
    renderChart(makeCounts({ maintenance: 1 }));
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
  });

  test('renders correctly with all statuses populated', () => {
    renderChart(makeCounts({
      available: 1, loading: 1, in_transit: 2,
      pouring: 1,   returning: 1, maintenance: 1,
    }));
    expect(screen.getByTestId('ag-charts-mock')).toBeInTheDocument();
  });
});
