/**
 * columnDefs — AG Grid column definitions for the Dispatch Board.
 *
 * Extracted into its own file so it can be imported by both DispatchGrid.tsx
 * and the test suite (we can test column configs in isolation without rendering
 * the full grid).
 */

import type { ColDef } from 'ag-grid-community';
import { StatusCellRenderer } from './cellRenderers/StatusCellRenderer';
import { TruckAssignmentRenderer } from './cellRenderers/TruckAssignmentRenderer';
import { TimeCellRenderer } from './cellRenderers/TimeCellRenderer';
import { HotLoadRenderer } from './cellRenderers/HotLoadRenderer';
import type { Order } from '@/types/domain';

/** Operational order for status sections (most urgent first). */
export const STATUS_DISPLAY_ORDER = [
  'pending',
  'scheduled',
  'dispatched',
  'in_transit',
  'pouring',
  'returning',
  'complete',
  'cancelled',
] as const;

// NOTE: sortable is disabled on all columns.
//
// DispatchGrid uses manually-injected group-header rows (one per status bucket)
// interleaved with real order rows. If AG Grid sorts the flat rowData array, the
// header rows — which all have requestedTime: '' — get separated from their order
// rows, causing all headers to stack at the top and all orders to pile below them.
//
// Ordering is fully owned by buildGridRows():
//   • status sections appear in STATUS_DISPLAY_ORDER
//   • orders within each section are sorted ascending by requestedTime
// Filters still work correctly because they hide rows without reordering them.

export const columnDefs: ColDef<Order>[] = [
  {
    field: 'ticketNumber',
    headerName: 'Ticket #',
    width: 115,
    pinned: 'left',
    cellStyle: { fontWeight: 600, fontFamily: 'monospace' },
    filter: 'agTextColumnFilter',
    sortable: false,
  },
  {
    field: 'isHotLoad',
    headerName: '',        // No header text — icon is self-explanatory
    width: 70,
    cellRenderer: HotLoadRenderer,
    sortable: false,
    filter: false,
    resizable: false,
    suppressHeaderMenuButton: true,
  },
  {
    field: 'customerName',
    headerName: 'Customer',
    flex: 1,
    minWidth: 160,
    filter: 'agTextColumnFilter',
    sortable: false,
  },
  {
    field: 'jobSiteName',
    headerName: 'Job Site',
    flex: 1,
    minWidth: 160,
    filter: 'agTextColumnFilter',
    sortable: false,
    tooltipField: 'jobSiteAddress',
  },
  {
    // Show mixDesignName + PSI together
    field: 'mixDesignName',
    headerName: 'Mix Design',
    width: 190,
    sortable: false,
    filter: 'agTextColumnFilter',
    valueFormatter: (p) => p.value ? `${p.value} (${p.data?.psi} PSI)` : '',
  },
  {
    field: 'volume',
    headerName: 'Volume',
    width: 100,
    type: 'numericColumn',
    sortable: false,
    filter: 'agNumberColumnFilter',
    valueFormatter: (p) => p.value != null ? `${p.value} yd³` : '',
  },
  {
    field: 'slump',
    headerName: 'Slump',
    width: 90,
    type: 'numericColumn',
    sortable: false,
    filter: 'agNumberColumnFilter',
    valueFormatter: (p) => p.value != null ? `${p.value}"` : '',
  },
  {
    field: 'requestedTime',
    headerName: 'Time',
    width: 130,
    cellRenderer: TimeCellRenderer,
    // No sort: 'asc' — buildGridRows already sorts orders by requestedTime
    // within each status group. A column sort would scatter the header rows.
    sortable: false,
    filter: false,
  },
  {
    // Virtual column: renders truck + driver via custom renderer
    field: 'assignedTruckNumber',
    headerName: 'Truck / Driver',
    width: 170,
    cellRenderer: TruckAssignmentRenderer,
    sortable: false,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
    cellRenderer: StatusCellRenderer,
    sortable: false,
    filter: 'agTextColumnFilter',
    pinned: 'right',
  },
];

/** Pinned bottom row showing aggregate totals for the visible orders. */
export function buildPinnedBottomRow(orders: Order[]): Partial<Order>[] {
  if (!orders.length) return [];

  const totalVolume = orders.reduce((sum, o) => sum + o.volume, 0);
  const dispatchedCount = orders.filter(
    (o) => !['complete', 'cancelled'].includes(o.status)
  ).length;

  return [
    {
      ticketNumber: `${orders.length} orders`,
      volume: parseFloat(totalVolume.toFixed(1)),
      customerName: `${dispatchedCount} active`,
      // Leave other fields empty so cells just render blank
    } as unknown as Partial<Order>,
  ];
}
