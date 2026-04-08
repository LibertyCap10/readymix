import type { Meta, StoryObj } from '@storybook/react';
import { UtilizationChart } from './UtilizationChart';
import type { UtilizationSegment } from '@/hooks/useAnalytics';

const meta: Meta<typeof UtilizationChart> = {
  title: 'Fleet/UtilizationChart',
  component: UtilizationChart,
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

type Story = StoryObj<typeof UtilizationChart>;

// Austin Central Plant — heavy week with some maintenance
export const HighUtilization: Story = {
  args: {
    segments: [
      { category: 'Productive',  hours: 137, color: '#37474F' },
      { category: 'Idle',        hours: 38,  color: '#FF6D00' },
      { category: 'Maintenance', hours: 25,  color: '#C62828' },
    ] as UtilizationSegment[],
    utilizationPct: 68,
  },
};

// Round Rock Plant — smaller fleet, leaner week
export const MediumUtilization: Story = {
  args: {
    segments: [
      { category: 'Productive',  hours: 75, color: '#37474F' },
      { category: 'Idle',        hours: 22, color: '#FF6D00' },
      { category: 'Maintenance', hours: 3,  color: '#C62828' },
    ] as UtilizationSegment[],
    utilizationPct: 75,
  },
};

// Fleet mostly idle — jobs not flowing
export const LowUtilization: Story = {
  args: {
    segments: [
      { category: 'Productive',  hours: 20, color: '#37474F' },
      { category: 'Idle',        hours: 80, color: '#FF6D00' },
      { category: 'Maintenance', hours: 0,  color: '#C62828' },
    ] as UtilizationSegment[],
    utilizationPct: 20,
  },
};

// Perfect utilization — every truck working, none idle or in maintenance
export const FullUtilization: Story = {
  args: {
    segments: [
      { category: 'Productive',  hours: 200, color: '#37474F' },
      { category: 'Idle',        hours: 0,   color: '#FF6D00' },
      { category: 'Maintenance', hours: 0,   color: '#C62828' },
    ] as UtilizationSegment[],
    utilizationPct: 100,
  },
};

// All zeros — shows empty-state message
export const NoData: Story = {
  args: {
    segments: [
      { category: 'Productive',  hours: 0, color: '#37474F' },
      { category: 'Idle',        hours: 0, color: '#FF6D00' },
      { category: 'Maintenance', hours: 0, color: '#C62828' },
    ] as UtilizationSegment[],
    utilizationPct: 0,
  },
};
