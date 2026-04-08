import type { Meta, StoryObj } from '@storybook/react';
import { CycleTimeChart } from './CycleTimeChart';
import type { CycleTimeChartPoint } from '@/hooks/useAnalytics';

const meta: Meta<typeof CycleTimeChart> = {
  title: 'Fleet/CycleTimeChart',
  component: CycleTimeChart,
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

type Story = StoryObj<typeof CycleTimeChart>;

// Typical 7-day window with variation around the 90-min target
export const SevenDays: Story = {
  args: {
    data: [
      { label: 'Mar 25', avgMinutes: 88 },
      { label: 'Mar 26', avgMinutes: 92 },
      { label: 'Mar 27', avgMinutes: 85 },
      { label: 'Mar 28', avgMinutes: 97 },
      { label: 'Mar 29', avgMinutes: 91 },
      { label: 'Mar 30', avgMinutes: 84 },
      { label: 'Mar 31', avgMinutes: 89 },
    ] as CycleTimeChartPoint[],
  },
};

// All days above the 90-min benchmark — route delay scenario
export const SlowWeek: Story = {
  args: {
    data: [
      { label: 'Mar 25', avgMinutes: 105 },
      { label: 'Mar 26', avgMinutes: 112 },
      { label: 'Mar 27', avgMinutes: 98 },
      { label: 'Mar 28', avgMinutes: 118 },
      { label: 'Mar 29', avgMinutes: 103 },
      { label: 'Mar 30', avgMinutes: 95 },
      { label: 'Mar 31', avgMinutes: 107 },
    ] as CycleTimeChartPoint[],
  },
};

// Efficient week — all times well below target
export const FastWeek: Story = {
  args: {
    data: [
      { label: 'Mar 25', avgMinutes: 72 },
      { label: 'Mar 26', avgMinutes: 68 },
      { label: 'Mar 27', avgMinutes: 75 },
      { label: 'Mar 28', avgMinutes: 71 },
      { label: 'Mar 29', avgMinutes: 66 },
      { label: 'Mar 30', avgMinutes: 73 },
      { label: 'Mar 31', avgMinutes: 69 },
    ] as CycleTimeChartPoint[],
  },
};

// Exactly one day (edge case)
export const SingleDay: Story = {
  args: {
    data: [{ label: 'Mar 31', avgMinutes: 90 }] as CycleTimeChartPoint[],
  },
};

// No data — shows empty-state message
export const NoData: Story = {
  args: {
    data: [] as CycleTimeChartPoint[],
  },
};
