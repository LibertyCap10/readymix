/**
 * DispatchGrid — the AG Grid dispatch board.
 *
 * Community-edition approach to status grouping:
 *   Orders are sorted in operational order (pending → dispatched → … → cancelled).
 *   A "group header" row is injected before each status section using AG Grid's
 *   `isFullWidthRow` + `fullWidthCellRenderer` callbacks. This gives the same
 *   visual effect as Enterprise row grouping without the license requirement.
 *
 *   See docs/review/04-ag-grid-deep-dive.md for a full explanation of why we
 *   chose this approach and what the Enterprise alternative looks like.
 *
 * Theming:
 *   Uses AG Grid's built-in `themeQuartz` (introduced in v33). The theme is
 *   customised to match our MUI slate/orange palette via `withParams()`.
 */

import { useRef, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
} from 'ag-grid-community';
import { Box, Typography, Stack } from '@mui/material';
import type { Order } from '@/types/domain';
import { StatusChip } from '@/components/StatusChip';
import type { OrderStatus } from '@/theme/statusColors';
import { columnDefs, buildPinnedBottomRow, STATUS_DISPLAY_ORDER } from './columnDefs';

// ─── Theming ──────────────────────────────────────────────────────────────────

const agGridTheme = themeQuartz.withParams({
  accentColor: '#FF6D00',                // Safety orange — selection highlight
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: 13,
  headerBackgroundColor: '#37474F',      // Slate gray header (matches MUI primary)
  headerTextColor: '#ffffff',
  headerFontWeight: 600,
  selectedRowBackgroundColor: '#E3F2FD', // MUI blue-50 — clear but not distracting
  oddRowBackgroundColor: '#FAFAFA',      // Subtle alternating rows
});

// ─── Group header row type ────────────────────────────────────────────────────

// We extend Order with optional group-header fields so both row types share
// the same TypeScript type (avoiding generic complexity with ColDef<T>).
type GridRow = Order & {
  _isGroupHeader?: boolean;
  _groupStatus?: OrderStatus;
  _groupCount?: number;
  _groupVolume?: number;
};

// ─── Group Header Renderer ────────────────────────────────────────────────────


function StatusGroupHeader({ data }: { data: GridRow }) {
  if (!data._isGroupHeader) return null;
  const status = data._groupStatus!;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        height: '100%',
        px: 2,
        bgcolor: 'grey.100',
        borderTop: '2px solid',
        borderColor: 'divider',
      }}
    >
      <StatusChip status={status} />
      <Typography variant="caption" color="text.secondary">
        {data._groupCount} {data._groupCount === 1 ? 'order' : 'orders'}
        {' · '}
        {data._groupVolume?.toFixed(1)} yd³
      </Typography>
    </Stack>
  );
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/** Sort orders by STATUS_DISPLAY_ORDER, then by requestedTime within each group. */
function buildGridRows(orders: Order[]): GridRow[] {
  const rows: GridRow[] = [];

  for (const status of STATUS_DISPLAY_ORDER) {
    const group = orders
      .filter((o) => o.status === status)
      .sort((a, b) => a.requestedTime.localeCompare(b.requestedTime));

    if (!group.length) continue;

    // Insert a full-width group header row before each status section
    rows.push({
      // Cast: group header rows don't have real Order fields, but AG Grid
      // only accesses them through the fullWidthCellRenderer.
      ticketNumber: `__header_${status}`,
      plantId: '',
      customerId: '',
      customerName: '',
      jobSiteId: '',
      jobSiteName: '',
      jobSiteAddress: '',
      mixDesignId: '',
      mixDesignName: '',
      psi: 0,
      volume: 0,
      slump: 0,
      pourType: 'slab',
      requestedTime: '',
      status,
      isHotLoad: false,
      events: [],
      createdAt: '',
      updatedAt: '',
      // Group-header metadata
      _isGroupHeader: true,
      _groupStatus: status,
      _groupCount: group.length,
      _groupVolume: group.reduce((s, o) => s + o.volume, 0),
    });

    rows.push(...group.map((o) => ({ ...o, _isGroupHeader: false })));
  }

  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DispatchGridProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

export function DispatchGrid({ orders, onOrderClick }: DispatchGridProps) {
  const gridRef = useRef<AgGridReact<GridRow>>(null);

  const gridRows = useMemo(() => buildGridRows(orders), [orders]);
  const pinnedBottomRowData = useMemo(() => buildPinnedBottomRow(orders) as GridRow[], [orders]);

  const getRowId = useCallback(
    (params: GetRowIdParams<GridRow>) => params.data.ticketNumber,
    []
  );

  const isFullWidthRow = useCallback(
    (params: { rowNode: { data?: GridRow } }) => !!params.rowNode.data?._isGroupHeader,
    []
  );

  const onRowClicked = useCallback(
    (event: { data?: GridRow }) => {
      const row = event.data;
      if (!row || row._isGroupHeader) return;
      onOrderClick(row as Order);
    },
    [onOrderClick]
  );

  // Suppress row click highlight on group headers
  const getRowClass = useCallback(
    (params: { data?: GridRow }) =>
      params.data?._isGroupHeader ? 'ag-row-no-hover' : undefined,
    []
  );

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <AgGridReact<GridRow>
        ref={gridRef}
        theme={agGridTheme}
        rowData={gridRows}
        columnDefs={columnDefs as ColDef<GridRow>[]}
        pinnedBottomRowData={pinnedBottomRowData}
        rowHeight={48}
        headerHeight={44}
        groupHeaderHeight={36}
        // Full-width rows for group headers
        isFullWidthRow={isFullWidthRow}
        fullWidthCellRenderer={StatusGroupHeader}
        // Row interaction
        rowSelection="single"
        onRowClicked={onRowClicked}
        getRowClass={getRowClass}
        getRowId={getRowId}
        // Tooltips for long content
        tooltipShowDelay={500}
        // Performance
        suppressColumnVirtualisation={false}
        animateRows
        // Accessibility
        suppressCellFocus={false}
      />
    </Box>
  );
}
