/**
 * PlantSelector tests
 *
 * MUI Autocomplete internals:
 *   The listbox opens on a full pointer interaction sequence, not just a single
 *   synthetic event. We use `userEvent.setup()` + `await user.click()` which
 *   fires the complete chain (pointerdown → mousedown → focus → pointerup →
 *   mouseup → click) and flushes all async React state updates via act().
 *
 *   `fireEvent.click` or `fireEvent.mouseDown` only fire one event and don't
 *   trigger MUI Autocomplete's open handler reliably.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlantSelector from './PlantSelector';
import { plants } from '../../mocks/plants';

describe('PlantSelector', () => {
  const defaultProps = {
    plants,
    selectedPlant: plants[0],
    onPlantChange: jest.fn(),
  };

  it('renders the selected plant name', () => {
    render(<PlantSelector {...defaultProps} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('Riverside Batch Plant');
  });

  it('shows dropdown options when clicked', async () => {
    const user = userEvent.setup();
    render(<PlantSelector {...defaultProps} />);
    // Click the ▼ popup indicator to open the listbox
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(screen.getByText('Northside Ready-Mix')).toBeInTheDocument();
  });

  it('calls onPlantChange when a different plant is selected', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<PlantSelector {...defaultProps} onPlantChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    await user.click(screen.getByText('Northside Ready-Mix'));
    expect(handleChange).toHaveBeenCalledWith(plants[1]);
  });
});
