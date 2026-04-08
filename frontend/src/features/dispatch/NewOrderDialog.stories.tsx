import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { NewOrderDialog } from './NewOrderDialog';
import type { NewOrderDraft } from '@/hooks/useOrders';

const meta: Meta<typeof NewOrderDialog> = {
  title: 'Dispatch/NewOrderDialog',
  component: NewOrderDialog,
  decorators: [
    (Story) => (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Story />
      </LocalizationProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NewOrderDialog>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
    onSubmit: (draft: NewOrderDraft) => console.log('Submitted:', draft),
  },
};

// Interactive story: shows the dialog toggled from a button, and logs submitted data
export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<NewOrderDraft | null>(null);

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div style={{ padding: 24 }}>
          <Button variant="contained" color="secondary" onClick={() => setOpen(true)}>
            + New Order
          </Button>
          {lastOrder && (
            <Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace' }}>
              Last submitted: {JSON.stringify(lastOrder, null, 2)}
            </Typography>
          )}
        </div>
        <NewOrderDialog
          open={open}
          onClose={() => setOpen(false)}
          onSubmit={(draft) => {
            setLastOrder(draft);
            setOpen(false);
          }}
        />
      </LocalizationProvider>
    );
  },
};
