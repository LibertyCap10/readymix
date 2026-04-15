import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  shape: {
    borderRadius: 12,
  },
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
    subtitle2: {
      fontWeight: 700,
      letterSpacing: '0.02em',
    },
    overline: {
      letterSpacing: '0.1em',
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        elevation: 1,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 1,
      },
      styleOverrides: {
        root: {
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          transition: 'all 0.15s ease',
        },
        clickable: {
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          transition: 'all 0.15s ease',
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '12px 0 0 12px',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

export default theme;
