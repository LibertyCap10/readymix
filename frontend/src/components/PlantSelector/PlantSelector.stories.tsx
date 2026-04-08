import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import PlantSelector from './PlantSelector';
import { plants } from '../../mocks/plants';
import Box from '@mui/material/Box';
import type { Plant } from '../../mocks/types';

const meta: Meta<typeof PlantSelector> = {
  title: 'Components/PlantSelector',
  component: PlantSelector,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof PlantSelector>;

export const Default: Story = {
  args: {
    plants,
    selectedPlant: plants[0],
  },
};

export const Interactive: Story = {
  render: () => {
    const [selected, setSelected] = useState<Plant>(plants[0]);
    return (
      <Box sx={{ p: 2, backgroundColor: '#37474F', borderRadius: 1 }}>
        <PlantSelector
          plants={plants}
          selectedPlant={selected}
          onPlantChange={setSelected}
        />
      </Box>
    );
  },
};

export const OnDarkBackground: Story = {
  render: () => (
    <Box sx={{ p: 2, backgroundColor: '#37474F', borderRadius: 1 }}>
      <PlantSelector
        plants={plants}
        selectedPlant={plants[1]}
        onPlantChange={() => {}}
      />
    </Box>
  ),
};
