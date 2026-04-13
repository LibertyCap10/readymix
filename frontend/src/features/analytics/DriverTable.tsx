import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Box, Typography } from '@mui/material';
import type { DriverScore } from '@/hooks/useAnalyticsDashboard';

interface Props {
  data: DriverScore[];
}

export function DriverTable({ data }: Props) {
  const columnDefs = useMemo<ColDef<DriverScore>[]>(
    () => [
      { field: 'name', headerName: 'Driver', flex: 2, minWidth: 140 },
      { field: 'deliveries', headerName: 'Deliveries', width: 110, type: 'numericColumn' },
      {
        field: 'totalVolume',
        headerName: 'Volume (yd\u00B3)',
        width: 120,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value?.toFixed(1) ?? '',
      },
      {
        field: 'avgCycleTime',
        headerName: 'Avg Cycle',
        width: 110,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value ? `${value} min` : '',
        cellStyle: ({ value }: { value: number }) => ({
          color: value <= 90 ? '#2E7D32' : '#D84315',
          fontWeight: 600,
        }),
      },
      {
        field: 'onTimePct',
        headerName: 'On-Time %',
        width: 110,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value != null ? `${value}%` : '',
        cellStyle: ({ value }: { value: number }) => ({
          color: value >= 90 ? '#2E7D32' : value >= 75 ? '#F57F17' : '#D84315',
          fontWeight: 600,
        }),
      },
      { field: 'plant', headerName: 'Plant', width: 150 },
    ],
    []
  );

  if (data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No driver data available</Typography>
      </Box>
    );
  }

  return (
    <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
      <AgGridReact<DriverScore>
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true }}
        domLayout="autoHeight"
        suppressCellFocus
      />
    </div>
  );
}
