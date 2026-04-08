import type { Meta, StoryObj } from '@storybook/react';
import StatusChip from './StatusChip';
import type { OrderStatus, TruckStatus } from '../../theme/statusColors';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const meta: Meta<typeof StatusChip> = {
  title: 'Components/StatusChip',
  component: StatusChip,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof StatusChip>;

export const Pending: Story = {
  args: { status: 'pending' },
};

export const Dispatched: Story = {
  args: { status: 'dispatched' },
};

export const InTransit: Story = {
  args: { status: 'in_transit' },
};

export const Pouring: Story = {
  args: { status: 'pouring' },
};

export const Returning: Story = {
  args: { status: 'returning' },
};

export const Complete: Story = {
  args: { status: 'complete' },
};

export const Cancelled: Story = {
  args: { status: 'cancelled' },
};

const allOrderStatuses: OrderStatus[] = [
  'pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled',
];

const allTruckStatuses: TruckStatus[] = [
  'available', 'loading', 'in_transit', 'pouring', 'returning', 'maintenance',
];

export const AllOrderStatuses: Story = {
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2" color="text.secondary">Order Statuses</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {allOrderStatuses.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </Box>
    </Box>
  ),
};

export const AllTruckStatuses: Story = {
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2" color="text.secondary">Truck Statuses</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {allTruckStatuses.map((s) => (
          <StatusChip key={s} status={s} variant="truck" />
        ))}
      </Box>
    </Box>
  ),
};
