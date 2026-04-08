import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import { DispatchPage } from './features/dispatch/DispatchPage';
import { FleetPage } from './features/fleet/FleetPage';

// Placeholder — replaced in a future phase
function AnalyticsPage() {
  return <div style={{ padding: 24 }}><h2>Analytics</h2><p>Coming in a future phase — volume, utilization, cycle times</p></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/dispatch" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
