import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OrdersPage } from './features/dispatch/OrdersPage';
import { FleetPage } from './features/fleet/FleetPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { MixesPage } from './features/mixes/MixesPage';
import { DispatchMapPage } from './features/dispatch-map/DispatchMapPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/mixes" element={<ErrorBoundary><MixesPage /></ErrorBoundary>} />
          <Route path="/fleet" element={<ErrorBoundary><FleetPage /></ErrorBoundary>} />
          <Route path="/orders" element={<ErrorBoundary><OrdersPage /></ErrorBoundary>} />
          <Route path="/dispatch" element={<ErrorBoundary><DispatchMapPage /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
