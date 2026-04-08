import type { Meta, StoryObj } from '@storybook/react';
import { PlantProvider } from '@/context/PlantContext';
import { FleetPage } from './FleetPage';

const meta: Meta<typeof FleetPage> = {
  title: 'Fleet/FleetPage',
  component: FleetPage,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      // FleetPage uses usePlant() and useFleet() which both need PlantProvider
      <PlantProvider>
        <div style={{ height: '100vh' }}>
          <Story />
        </div>
      </PlantProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof FleetPage>;

/**
 * Default story: uses the mock data from usePlant (plants[0] = Austin Central
 * Plant) and live-ticker simulation. Statuses will update every 10 seconds.
 *
 * This is the primary way to visually verify the fleet dashboard layout,
 * chart rendering, and countdown badge.
 */
export const Default: Story = {};
