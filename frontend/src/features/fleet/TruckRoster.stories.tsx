import type { Meta, StoryObj } from '@storybook/react';
import { TruckRoster } from './TruckRoster';
import { trucks } from '@/mocks';

const meta: Meta<typeof TruckRoster> = {
  title: 'Fleet/TruckRoster',
  component: TruckRoster,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: 360, padding: '0 16px' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TruckRoster>;

// Austin Central Plant fleet (PLANT-001) — 5 trucks including one in maintenance
export const Plant001Fleet: Story = {
  args: {
    trucks: trucks.filter((t) => t.plantId === 'PLANT-001'),
  },
};

// Round Rock Plant fleet (PLANT-002) — 3 trucks, all operational
export const Plant002Fleet: Story = {
  args: {
    trucks: trucks.filter((t) => t.plantId === 'PLANT-002'),
  },
};

// Full fleet across all plants
export const AllTrucks: Story = {
  args: {
    trucks,
  },
};

// Single truck — minimum valid roster
export const SingleTruck: Story = {
  args: {
    trucks: [trucks[0]],
  },
};

// No trucks — renders the empty-state message
export const EmptyFleet: Story = {
  args: {
    trucks: [],
  },
};
