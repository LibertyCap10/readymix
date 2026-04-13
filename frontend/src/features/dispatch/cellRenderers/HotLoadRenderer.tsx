/**
 * HotLoadRenderer — shows a bright "HOT" chip for priority loads,
 * or nothing for regular orders. Hot loads need the truck rolling ASAP.
 */

import type { CustomCellRendererProps } from 'ag-grid-react';
import { Chip } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import type { Order } from '@/types/domain';

export function HotLoadRenderer(props: CustomCellRendererProps<Order>) {
  if (!props.data?.isHotLoad) return null;

  return (
    <Chip
      icon={<LocalFireDepartmentIcon />}
      label="HOT"
      size="small"
      sx={{
        bgcolor: 'error.main',
        color: '#fff',
        fontWeight: 700,
        fontSize: 10,
        height: 22,
        '& .MuiChip-icon': { color: '#fff', fontSize: 13 },
      }}
    />
  );
}
