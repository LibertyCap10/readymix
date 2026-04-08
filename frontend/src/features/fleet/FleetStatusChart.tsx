/**
 * FleetStatusChart — bar chart showing how many trucks are in each status.
 *
 * Data flows: useFleet() → statusCounts → this chart.
 * Updates every time the fleet ticker fires (every 10s).
 *
 * AG Charts note: we pass `fills` as an array so each bar gets its own
 * status color. AG Charts cycles through the fills array in data order.
 */

import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { Box, Typography } from '@mui/material';
import type { TruckStatus } from '@/theme/statusColors';
import { truckStatusColors } from '@/theme/statusColors';

// Display order: operational sequence, most interesting first
const STATUS_ORDER: TruckStatus[] = [
  'in_transit',
  'pouring',
  'loading',
  'returning',
  'available',
  'maintenance',
];

interface FleetStatusChartProps {
  statusCounts: Record<TruckStatus, number>;
}

export function FleetStatusChart({ statusCounts }: FleetStatusChartProps) {
  // useMemo without explicit generic — letting TypeScript infer the concrete type
  // avoids the AgChartOptions discriminated-union mismatch that causes TS errors.
  const options = useMemo(() => {
    const data = STATUS_ORDER.map((status) => ({
      status: truckStatusColors[status]?.label ?? status,
      count: statusCounts[status] ?? 0,
      fill: truckStatusColors[status]?.text ?? '#37474F',
    }));

    return {
      data,
      series: [
        {
          type: 'bar' as const,
          xKey: 'status',
          yKey: 'count',
          yName: 'Trucks',
          // Each bar gets the colour of its status via itemStyler
          itemStyler: ({ datum }: { datum: { fill: string } }) => ({
            fill: datum.fill,
            stroke: 'transparent',
          }),
          label: {
            enabled: true,
            formatter: ({ value }: { value: number }) =>
              value > 0 ? String(value) : '',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 'bold' as const,
          },
          tooltip: {
            renderer: ({ datum }: { datum: { status: string; count: number } }) => ({
              title: datum.status,
              content: `${datum.count} truck${datum.count !== 1 ? 's' : ''}`,
            }),
          },
        },
      ],
      // AG Charts v13: axes is an object keyed by direction ('x'/'y'),
      // not an array. Object.keys/values are used internally to map each
      // axis to its rendering direction — an array would fail that mapping.
      axes: {
        x: {
          type: 'category' as const,
          label: { fontSize: 11 },
        },
        y: {
          type: 'number' as const,
          title: { text: 'Trucks', fontSize: 11 },
          tick: { interval: 1 },
          min: 0,
        },
      },
      background: { fill: 'transparent' },
      padding: { top: 8, right: 12, bottom: 8, left: 8 },
    };
  }, [statusCounts]);

  const total = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  if (total === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">No trucks found for this plant.</Typography>
      </Box>
    );
  }

  return <AgCharts options={options as AgChartOptions} style={{ height: '100%', width: '100%' }} />;
}
