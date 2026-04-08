/**
 * CycleTimeChart — line chart showing 7-day average cycle time trend.
 *
 * "Cycle time" = total minutes from plant departure → return after washout.
 * The 90-min reference line gives dispatchers an at-a-glance performance signal.
 *
 * Data flows: useAnalytics() → cycleTimePoints → this chart.
 */

import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { Box, Typography } from '@mui/material';
import type { CycleTimeChartPoint } from '@/hooks/useAnalytics';

// Industry benchmark — if avg goes above this, investigate route delays or over-pours
const BENCHMARK_MINUTES = 90;

interface CycleTimeChartProps {
  data: CycleTimeChartPoint[];
}

export function CycleTimeChart({ data }: CycleTimeChartProps) {
  // useMemo without explicit generic — avoids the AgChartOptions union mismatch.
  const options = useMemo(() => ({
    data,
    series: [
      {
        type: 'line' as const,
        xKey: 'label',
        yKey: 'avgMinutes',
        yName: 'Avg Cycle Time',
        stroke: '#37474F',
        strokeWidth: 2,
        marker: {
          enabled: true,
          size: 6,
          fill: '#FF6D00',
          stroke: '#FF6D00',
        },
        tooltip: {
          renderer: ({ datum }: { datum: { label: string; avgMinutes: number } }) => ({
            title: datum.label,
            content: `${datum.avgMinutes} min avg cycle`,
          }),
        },
      },
    ],
    // AG Charts v13: axes is an object keyed by direction ('x'/'y'), not an array.
    axes: {
      x: {
        type: 'category' as const,
        label: { fontSize: 11 },
      },
      y: {
        type: 'number' as const,
        title: { text: 'Minutes', fontSize: 11 },
        min: 0,
        // Draw a reference line at the 90-min benchmark
        crossLines: [
          {
            type: 'line' as const,
            value: BENCHMARK_MINUTES,
            stroke: '#FF6D00',
            strokeWidth: 1,
            strokeDashArray: [6, 3],
            label: {
              text: `${BENCHMARK_MINUTES} min target`,
              fontSize: 10,
              color: '#FF6D00',
              position: 'top-left' as const,
            },
          },
        ],
      },
    },
    background: { fill: 'transparent' },
    padding: { top: 8, right: 12, bottom: 8, left: 8 },
  }), [data]);

  if (!data.length) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">No cycle time data.</Typography>
      </Box>
    );
  }

  return <AgCharts options={options as AgChartOptions} style={{ height: '100%', width: '100%' }} />;
}
