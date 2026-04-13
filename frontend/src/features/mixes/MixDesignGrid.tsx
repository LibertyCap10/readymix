/**
 * MixDesignGrid — AG Grid table showing mix designs for the selected plant.
 *
 * Columns: Code, Name, PSI, Slump, Cost/yd, Applications, Active.
 * Row click opens the detail drawer.
 */

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz, type ColDef } from 'ag-grid-community';
import { Box, Chip, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { MixDesign, PourType } from '@/types/domain';

// ─── Theme ────────────────────────────────────────────────────────────────────

const gridTheme = themeQuartz.withParams({
  accentColor: '#FF6D00',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: 13,
  headerBackgroundColor: '#37474F',
  headerTextColor: '#ffffff',
  headerFontWeight: 600,
  selectedRowBackgroundColor: '#E3F2FD',
  oddRowBackgroundColor: '#FAFAFA',
});

// ─── Label helpers ──────────────────────────────────────────────────────────

const POUR_TYPE_LABELS: Record<PourType, string> = {
  foundation: 'Foundation',
  slab: 'Slab',
  wall: 'Wall',
  driveway: 'Driveway',
  sidewalk: 'Sidewalk',
  column: 'Column',
  footing: 'Footing',
  grade_beam: 'Grade Beam',
};

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function ApplicationsRenderer(props: CustomCellRendererProps<MixDesign>) {
  const apps = props.value as PourType[] | undefined;
  if (!apps || apps.length === 0) return <Typography variant="caption" color="text.secondary">--</Typography>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
      {apps.map(pt => (
        <Chip
          key={pt}
          label={POUR_TYPE_LABELS[pt] ?? pt}
          size="small"
          sx={{ fontSize: 11, height: 20 }}
        />
      ))}
    </Box>
  );
}

function ActiveRenderer(props: CustomCellRendererProps<MixDesign>) {
  const isActive = props.value as boolean;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <CircleIcon sx={{ fontSize: 10, color: isActive ? 'success.main' : 'text.disabled' }} />
    </Box>
  );
}

// ─── Column Definitions ──────────────────────────────────────────────────────

const columnDefs: ColDef<MixDesign>[] = [
  {
    field: 'code',
    headerName: 'Code',
    width: 150,
    pinned: 'left',
    cellStyle: { fontWeight: 700, fontFamily: 'monospace' },
    sortable: true,
  },
  {
    field: 'name',
    headerName: 'Mix Name',
    flex: 1,
    minWidth: 180,
    sortable: true,
  },
  {
    field: 'psi',
    headerName: 'PSI',
    width: 100,
    type: 'numericColumn',
    sortable: true,
    valueFormatter: p => p.value != null ? `${Number(p.value).toLocaleString()}` : '',
  },
  {
    headerName: 'Slump',
    width: 100,
    sortable: true,
    valueGetter: p => p.data ? `${p.data.slumpMin}-${p.data.slumpMax}"` : '',
  },
  {
    field: 'costPerYard',
    headerName: 'Cost/yd',
    width: 110,
    type: 'numericColumn',
    sortable: true,
    valueFormatter: p => p.value != null ? `$${Number(p.value).toFixed(2)}` : '--',
  },
  {
    field: 'applications',
    headerName: 'Applications',
    flex: 1,
    minWidth: 200,
    cellRenderer: ApplicationsRenderer,
    sortable: false,
    autoHeight: true,
  },
  {
    field: 'isActive',
    headerName: '',
    width: 50,
    cellRenderer: ActiveRenderer,
    sortable: false,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface MixDesignGridProps {
  mixDesigns: MixDesign[];
  onRowClick: (mix: MixDesign) => void;
}

export function MixDesignGrid({ mixDesigns, onRowClick }: MixDesignGridProps) {
  const defaultColDef = useMemo<ColDef<MixDesign>>(() => ({
    resizable: true,
  }), []);

  if (!mixDesigns.length) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No mix designs available for this plant.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <AgGridReact<MixDesign>
        theme={gridTheme}
        rowData={mixDesigns}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={52}
        headerHeight={44}
        rowSelection="single"
        animateRows
        getRowId={p => p.data.mixDesignId}
        onRowClicked={e => e.data && onRowClick(e.data)}
        suppressCellFocus={false}
      />
    </Box>
  );
}
