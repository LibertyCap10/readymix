/**
 * TruckRoster — AG Grid table showing the plant's truck fleet.
 *
 * Shows live-updated statuses (from useFleetTicker via useFleet).
 * Clicking a row highlights it; future phases can open a truck detail drawer.
 *
 * Reuses the same themeQuartz + AllCommunityModule setup registered in main.tsx.
 */

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Box, Typography, Chip } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import type { Truck } from '@/types/domain';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { StatusChip } from '@/components/StatusChip';
import type { TruckStatus } from '@/theme/statusColors';
import dayjs from 'dayjs';

import { agGridTheme } from '@/theme/agGridTheme';

// ─── Cell Renderers ───────────────────────────────────────────────────────────

function TruckStatusRenderer(props: CustomCellRendererProps<Truck>) {
  const status = props.value as TruckStatus;
  if (!status) return null;
  return <StatusChip status={status} variant="truck" />;
}

function DriverRenderer(props: CustomCellRendererProps<Truck>) {
  const truck = props.data;
  if (!truck) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.3 }}>
        {truck.driver.name}
      </Typography>
      {truck.driver.certifications.length > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
          {truck.driver.certifications.slice(0, 2).join(', ')}
        </Typography>
      )}
    </Box>
  );
}

function MaintenanceRenderer(props: CustomCellRendererProps<Truck>) {
  const truck = props.data;
  if (!truck) return null;
  if (truck.currentStatus === 'maintenance') {
    return (
      <Chip
        icon={<BuildIcon />}
        label="In Shop"
        size="small"
        sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 600, fontSize: 11,
              '& .MuiChip-icon': { color: '#C62828', fontSize: 14 } }}
      />
    );
  }
  return (
    <Typography variant="caption" color="text.secondary">
      {dayjs(truck.lastWashout).format('h:mm A')}
    </Typography>
  );
}

// ─── Column Definitions ───────────────────────────────────────────────────────

const columnDefs: ColDef<Truck>[] = [
  {
    field: 'truckNumber',
    headerName: 'Truck #',
    width: 95,
    pinned: 'left',
    cellStyle: { fontWeight: 700, fontFamily: 'monospace' },
    sortable: true,
  },
  {
    // Driver name + certifications via custom renderer
    field: 'driver',
    headerName: 'Driver',
    flex: 1,
    minWidth: 160,
    sortable: true,
    cellRenderer: DriverRenderer,
    comparator: (a, b) => a.name.localeCompare(b.name),
  },
  {
    field: 'capacity',
    headerName: 'Capacity',
    width: 100,
    type: 'numericColumn',
    sortable: true,
    valueFormatter: (p) => p.value != null ? `${p.value} yd³` : '',
  },
  {
    field: 'currentStatus',
    headerName: 'Status',
    width: 140,
    cellRenderer: TruckStatusRenderer,
    sortable: true,
    pinned: 'right',
  },
  {
    field: 'currentJobSite',
    headerName: 'Job Site',
    flex: 1,
    minWidth: 140,
    sortable: true,
    valueFormatter: (p) => p.value ?? '—',
  },
  {
    field: 'loadsToday',
    headerName: 'Loads Today',
    width: 115,
    type: 'numericColumn',
    sortable: true,
  },
  {
    // Shows last washout time or "In Shop" for maintenance trucks
    field: 'lastWashout',
    headerName: 'Last Washout',
    width: 120,
    cellRenderer: MaintenanceRenderer,
    sortable: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TruckRosterProps {
  trucks: Truck[];
}

export function TruckRoster({ trucks }: TruckRosterProps) {
  const defaultColDef = useMemo<ColDef<Truck>>(() => ({
    resizable: true,
  }), []);

  if (!trucks.length) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No trucks registered for this plant.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <AgGridReact<Truck>
        theme={agGridTheme}
        rowData={trucks}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={52}
        headerHeight={44}
        rowSelection={{ mode: "singleRow" }}
        animateRows
        getRowId={(p) => p.data.truckId}
        suppressCellFocus={false}
      />
    </Box>
  );
}
