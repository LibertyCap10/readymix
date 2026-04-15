import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Box, Typography } from '@mui/material';
import type { CustomerScore } from '@/hooks/useAnalyticsDashboard';
import { agGridTheme } from '@/theme/agGridTheme';

interface Props {
  data: CustomerScore[];
}

export function CustomerTable({ data }: Props) {
  const columnDefs = useMemo<ColDef<CustomerScore>[]>(
    () => [
      { field: 'name', headerName: 'Customer', flex: 2, minWidth: 160 },
      { field: 'totalOrders', headerName: 'Orders', width: 90, type: 'numericColumn' },
      {
        field: 'totalVolume',
        headerName: 'Volume (yd\u00B3)',
        width: 120,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value?.toFixed(1) ?? '',
      },
      {
        field: 'revenue',
        headerName: 'Revenue',
        width: 120,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value ? `$${Number(value).toLocaleString()}` : '',
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
      {
        field: 'avgCycleTime',
        headerName: 'Avg Cycle',
        width: 110,
        type: 'numericColumn',
        valueFormatter: ({ value }) => value ? `${value} min` : '',
      },
      {
        field: 'lastDelivery',
        headerName: 'Last Delivery',
        width: 130,
        valueFormatter: ({ value }) => {
          if (!value) return '';
          return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
      },
    ],
    []
  );

  if (data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No customer data available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <AgGridReact<CustomerScore>
        theme={agGridTheme}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true }}
        domLayout="autoHeight"
        suppressCellFocus
      />
    </Box>
  );
}
