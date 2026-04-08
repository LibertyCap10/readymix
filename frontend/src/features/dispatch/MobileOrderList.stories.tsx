import type { Meta, StoryObj } from '@storybook/react';
import { MobileOrderList } from './MobileOrderList';
import { orders } from '@/mocks';

const meta: Meta<typeof MobileOrderList> = {
  title: 'Dispatch/MobileOrderList',
  component: MobileOrderList,
  parameters: {
    // Simulate a mobile viewport in Storybook
    viewport: { defaultViewport: 'mobile1' },
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof MobileOrderList>;

export const AllOrders: Story = {
  args: {
    orders: orders.slice(0, 8),
    onOrderClick: (order) => console.log('Clicked:', order.ticketNumber),
  },
};

export const WithHotLoads: Story = {
  args: {
    orders: orders.filter((o) => o.isHotLoad || o.status === 'in_transit').slice(0, 4),
    onOrderClick: () => {},
  },
};

export const EmptyState: Story = {
  args: {
    orders: [],
    onOrderClick: () => {},
  },
};

export const SingleCard: Story = {
  args: {
    orders: [orders[0]],
    onOrderClick: () => {},
  },
};
