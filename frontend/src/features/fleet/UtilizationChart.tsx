/**
 * UtilizationChart — donut chart showing fleet utilization breakdown.
 *
 * Segments:
 *   Productive (slate)   — loading + in-transit + pouring + returning
 *   Idle (orange)        — available but not dispatched
 *   Maintenance (red)    — truck down for service
 *
 * The centre label shows the utilization % so the KPI is immediately visible
 * without reading the chart detail.
 *
 * Data flows: useAnalytics() → utilizationSegments → this chart.
 */

import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { Box, Typography } from '@mui/material';
import type { UtilizationSegment } from '@/hooks/useAnalytics';

interface UtilizationChartProps {
  segments: UtilizationSegment[];
  utilizationPct: number;
}

export function UtilizationChart({ segments, utilizationPct }: UtilizationChartProps) {
  // useMemo without explicit generic — avoids the AgChartOptions union mismatch.
  const options = useMemo(() => ({
    data: segments,
    series: [
      {
        type: 'donut' as const,
        angleKey: 'hours',
        calloutLabelKey: 'category',
        legendItemKey: 'category',
        // Use the pre-computed per-segment colors
        itemStyler: ({ datum }: { datum: UtilizationSegment }) => ({
          fill: datum.color,
          stroke: '#ffffff',
          strokeWidth: 2,
        }),
        innerRadiusRatio: 0.72,
        // Centre annotation showing the utilisation %
        innerLabels: [
          {
            text: `${utilizationPct}%`,
            fontSize: 22,
            fontWeight: 'bold' as const,
            color: '#37474F',
          },
          {
            text: 'utilised',
            fontSize: 11,
            color: '#78909C',
          },
        ],
        tooltip: {
          renderer: ({ datum }: { datum: UtilizationSegment }) => ({
            title: datum.category,
            content: `${datum.hours} hrs`,
          }),
        },
      },
    ],
    legend: {
      position: 'bottom' as const,
      item: { label: { fontSize: 11 } },
    },
    background: { fill: 'transparent' },
    padding: { top: 8, right: 8, bottom: 8, left: 8 },
  }), [segments, utilizationPct]);

  if (!segments.length || segments.every((s) => s.hours === 0)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">No utilization data.</Typography>
      </Box>
    );
  }

  return <AgCharts options={options as AgChartOptions} style={{ height: '100%', width: '100%' }} />;
}
