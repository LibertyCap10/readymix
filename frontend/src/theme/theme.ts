import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#37474F',     // Blue Grey 800 — slate gray, industrial feel
      light: '#62727B',
      dark: '#102027',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#FF6D00',     // Safety orange — high-visibility accent
      light: '#FF9E40',
      dark: '#C43E00',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F5F5',  // Light gray workspace
      paper: '#FFFFFF',
    },
    info: {
      main: '#1565C0',     // Status blue — dispatched/active indicators
    },
    success: {
      main: '#2E7D32',
    },
    warning: {
      main: '#F57F17',
    },
    error: {
      main: '#C62828',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        elevation: 1,
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 1,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '12px 0 0 12px',
        },
      },
    },
  },
});

export default theme;
