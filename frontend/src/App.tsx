import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DispatchPage } from './features/dispatch/DispatchPage';
import { FleetPage } from './features/fleet/FleetPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { MixesPage } from './features/mixes/MixesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dispatch" element={<ErrorBoundary><DispatchPage /></ErrorBoundary>} />
          <Route path="/mixes" element={<ErrorBoundary><MixesPage /></ErrorBoundary>} />
          <Route path="/fleet" element={<ErrorBoundary><FleetPage /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/dispatch" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
