import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from '@mui/material';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import type { Order } from '@/mocks/types';

const FULL_ORDER: Order = {
  ticketNumber:   'TKT-001',
  plantId:        'PLANT-001',
  customerId:     'CUST-001',
  customerName:   'Meridian Construction',
  jobSiteId:      'SITE-001',
  jobSiteName:    'Eastside Tower Foundation',
  jobSiteAddress: '900 E 6th St, Austin, TX 78702',
  mixDesignId:    'MIX-4000-LS',
  mixDesignName:  '4000 PSI Limestone',
  psi:            4000,
  volume:         6.5,
  slump:          4,
  pourType:       'foundation',
  requestedTime:  '2026-03-31T09:30:00.000Z',
  assignedTruckNumber: '101',
  driverName:     'Jesse Ramirez',
  status:         'in_transit',
  isHotLoad:      false,
  notes:          'Use the south gate. Watch for rebar sticking up on north side.',
  events: [
    { timestamp: '2026-03-31T07:00:00.000Z', eventType: 'pending',    note: 'Order created by dispatch' },
    { timestamp: '2026-03-31T07:45:00.000Z', eventType: 'dispatched', note: 'Truck 101 assigned' },
    { timestamp: '2026-03-31T08:30:00.000Z', eventType: 'in_transit', note: 'Departed plant' },
  ],
  createdAt: '2026-03-31T07:00:00.000Z',
  updatedAt: '2026-03-31T08:30:00.000Z',
};

const meta: Meta<typeof OrderDetailDrawer> = {
  title: 'Components/OrderDetailDrawer',
  component: OrderDetailDrawer,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof OrderDetailDrawer>;

export const OpenWithOrder: Story = {
  args: { order: FULL_ORDER, open: true, onClose: () => {} },
};

export const HotLoad: Story = {
  args: { order: { ...FULL_ORDER, isHotLoad: true }, open: true, onClose: () => {} },
};

export const CompletedOrder: Story = {
  args: {
    order: {
      ...FULL_ORDER,
      status: 'complete',
      events: [
        ...FULL_ORDER.events,
        { timestamp: '2026-03-31T09:45:00.000Z', eventType: 'pouring',   note: 'Discharge started' },
        { timestamp: '2026-03-31T10:30:00.000Z', eventType: 'returning', note: 'Washout complete' },
        { timestamp: '2026-03-31T11:00:00.000Z', eventType: 'complete',  note: 'Returned to plant' },
      ],
    },
    open: true,
    onClose: () => {},
  },
};

export const UnassignedTruck: Story = {
  args: {
    order: { ...FULL_ORDER, status: 'pending', assignedTruckNumber: undefined, driverName: undefined },
    open: true,
    onClose: () => {},
  },
};

export const NoOrder: Story = {
  args: { order: null, open: true, onClose: () => {} },
};

// Interactive: shows a button to toggle the drawer open/closed
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <div style={{ padding: 24 }}>
          <Button variant="contained" onClick={() => setOpen(true)}>
            Open Drawer
          </Button>
        </div>
        <OrderDetailDrawer order={FULL_ORDER} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
};
