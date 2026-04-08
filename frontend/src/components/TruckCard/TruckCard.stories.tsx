import type { Meta, StoryObj } from '@storybook/react';
import TruckCard from './TruckCard';
import { trucks } from '../../mocks/trucks';
import Box from '@mui/material/Box';

const meta: Meta<typeof TruckCard> = {
  title: 'Components/TruckCard',
  component: TruckCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 360 }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TruckCard>;

export const InTransit: Story = {
  args: { truck: trucks[0] }, // TRUCK-101: in_transit
};

export const Pouring: Story = {
  args: { truck: trucks[1] }, // TRUCK-102: pouring
};

export const Available: Story = {
  args: { truck: trucks[2] }, // TRUCK-103: available
};

export const Returning: Story = {
  args: { truck: trucks[3] }, // TRUCK-104: returning
};

export const Maintenance: Story = {
  args: { truck: trucks[4] }, // TRUCK-105: maintenance
};

export const AllTrucks: Story = {
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 360 }}>
      {trucks.map((t) => (
        <TruckCard key={t.truckId} truck={t} onClick={() => {}} />
      ))}
    </Box>
  ),
};
