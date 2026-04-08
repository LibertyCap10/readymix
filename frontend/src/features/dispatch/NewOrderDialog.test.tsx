import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { theme } from '@/theme';
import { NewOrderDialog } from './NewOrderDialog';

function renderDialog(onSubmit = jest.fn(), open = true) {
  return render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <NewOrderDialog open={open} onClose={jest.fn()} onSubmit={onSubmit} />
      </LocalizationProvider>
    </ThemeProvider>
  );
}

describe('NewOrderDialog', () => {
  test('renders the dialog title', () => {
    renderDialog();
    expect(screen.getByText('New Delivery Order')).toBeInTheDocument();
  });

  test('renders all required field labels', () => {
    renderDialog();
    expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mix design/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slump/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pour type/i)).toBeInTheDocument();
  });

  test('shows validation errors when submitting empty form', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /create order/i }));

    await waitFor(() => {
      expect(screen.getByText(/customer is required/i)).toBeInTheDocument();
    });
  });

  test('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <NewOrderDialog open={true} onClose={onClose} onSubmit={jest.fn()} />
        </LocalizationProvider>
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('job site field is disabled until customer is selected', () => {
    renderDialog();
    // MUI Select renders a <div role="combobox"> with aria-disabled="true" rather
    // than a native <select disabled>. toBeDisabled() only checks the native HTML
    // attribute on non-form elements, so we assert on the ARIA attribute directly.
    expect(screen.getByLabelText(/job site/i)).toHaveAttribute('aria-disabled', 'true');
  });

  test('hot load switch is rendered and toggleable', async () => {
    renderDialog();
    const hotLoadSwitch = screen.getByRole('checkbox');
    expect(hotLoadSwitch).not.toBeChecked();
    await userEvent.click(hotLoadSwitch);
    expect(hotLoadSwitch).toBeChecked();
  });
});
