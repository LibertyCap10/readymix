/**
 * StatusCellRenderer — renders a StatusChip inside an AG Grid cell.
 * AG Grid passes the cell value (the order status string) as `props.value`.
 */

import type { CustomCellRendererProps } from 'ag-grid-react';
import { StatusChip } from '@/components/StatusChip';
import type { OrderStatus } from '@/theme/statusColors';

export function StatusCellRenderer(props: CustomCellRendererProps) {
  const status = props.value as OrderStatus;
  if (!status) return null;
  return <StatusChip status={status} />;
}
