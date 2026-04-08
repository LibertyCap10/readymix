import type { Meta, StoryObj } from '@storybook/react';
import { FleetStatusChart } from './FleetStatusChart';
import type { TruckStatus } from '@/theme/statusColors';

const meta: Meta<typeof FleetStatusChart> = {
  title: 'Fleet/FleetStatusChart',
  component: FleetStatusChart,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ height: 260, width: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof FleetStatusChart>;

// Typical mid-shift snapshot: trucks spread across multiple statuses
export const MidShift: Story = {
  args: {
    statusCounts: {
      in_transit:  3,
      pouring:     2,
      loading:     1,
      returning:   2,
      available:   1,
      maintenance: 1,
    } as Record<TruckStatus, number>,
  },
};

// All trucks on the road — no available, no maintenance
export const AllActive: Story = {
  args: {
    statusCounts: {
      in_transit:  4,
      pouring:     2,
      loading:     2,
      returning:   2,
      available:   0,
      maintenance: 0,
    } as Record<TruckStatus, number>,
  },
};

// Several trucks down for service
export const HeavyMaintenance: Story = {
  args: {
    statusCounts: {
      in_transit:  1,
      pouring:     0,
      loading:     1,
      returning:   0,
      available:   2,
      maintenance: 4,
    } as Record<TruckStatus, number>,
  },
};

// No activity — shows empty-state message
export const EmptyFleet: Story = {
  args: {
    statusCounts: {
      in_transit:  0,
      pouring:     0,
      loading:     0,
      returning:   0,
      available:   0,
      maintenance: 0,
    } as Record<TruckStatus, number>,
  },
};

// Single truck fleet
export const SingleTruck: Story = {
  args: {
    statusCounts: {
      in_transit:  0,
      pouring:     0,
      loading:     0,
      returning:   0,
      available:   1,
      maintenance: 0,
    } as Record<TruckStatus, number>,
  },
};
