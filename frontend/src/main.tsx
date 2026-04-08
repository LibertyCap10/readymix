import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// AG Grid v33+: register all community modules once at the app root.
// This replaces the per-module imports from older versions.
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

// AG Charts v13+: same ModuleRegistry pattern as AG Grid.
// ModuleRegistry is re-exported from ag-charts-core via ag-charts-community.
// Must run before any AgCharts.create() — i.e., before any chart component mounts.
import {
  ModuleRegistry as ChartsModuleRegistry,
  AllCommunityModule as AllChartsModule,
} from 'ag-charts-community';
ChartsModuleRegistry.registerModules([AllChartsModule]);

import { theme } from './theme';
import { PlantProvider } from './context/PlantContext';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* LocalizationProvider is required by @mui/x-date-pickers (DatePicker, DateTimePicker) */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <PlantProvider>
          <App />
        </PlantProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
