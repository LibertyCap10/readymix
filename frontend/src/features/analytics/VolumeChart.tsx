import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { Box, Typography } from '@mui/material';
import type { VolumePoint } from '@/hooks/useAnalyticsDashboard';

interface Props {
  data: VolumePoint[];
}

export function VolumeChart({ data }: Props) {
  const chartData = useMemo(
    () => data.map((d) => ({
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volumeYards: d.volumeYards,
    })),
    [data]
  );

  const options = useMemo<AgChartOptions>(
    () => ({
      data: chartData,
      series: [
        {
          type: 'bar' as const,
          xKey: 'label',
          yKey: 'volumeYards',
          yName: 'Volume (yd\u00B3)',
          fill: '#37474F',
          cornerRadius: 4,
          tooltip: {
            renderer: ({ datum }: { datum: Record<string, unknown> }) => ({
              title: String(datum.label),
              content: `${datum.volumeYards} yd\u00B3`,
            }),
          },
        },
      ],
      axes: {
        bottom: {
          type: 'category' as const,
          label: { fontSize: 11, color: '#666' },
        },
        left: {
          type: 'number' as const,
          label: { fontSize: 11, color: '#666' },
          title: { text: 'yd\u00B3', fontSize: 11 },
        },
      },
      background: { fill: 'transparent' },
      padding: { top: 8, right: 12, bottom: 8, left: 8 },
    }),
    [chartData]
  );

  if (chartData.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary" variant="body2">No volume data</Typography>
      </Box>
    );
  }

  return <AgCharts options={options} style={{ height: '100%', width: '100%' }} />;
}
