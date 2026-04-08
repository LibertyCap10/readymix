import Chip from '@mui/material/Chip';
import {
  orderStatusColors,
  truckStatusColors,
  type OrderStatus,
  type TruckStatus,
} from '../../theme/statusColors';

type StatusChipProps =
  | { status: OrderStatus; variant?: 'order' }
  | { status: TruckStatus; variant: 'truck' };

export default function StatusChip(props: StatusChipProps) {
  const { status } = props;
  const variant = 'variant' in props ? props.variant : 'order';

  const colorMap = variant === 'truck' ? truckStatusColors : orderStatusColors;
  const colors = colorMap[status as keyof typeof colorMap];

  if (!colors) return null;

  return (
    <Chip
      label={colors.label}
      size="small"
      sx={{
        backgroundColor: colors.background,
        color: colors.text,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
      }}
    />
  );
}
