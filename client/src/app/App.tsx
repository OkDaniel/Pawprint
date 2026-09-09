import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AuthPage } from '../features/auth/AuthPage';
import { CheckInPage } from '../features/checkIn/CheckInPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { HomeLayer } from '../features/home/HomeLayer';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<AppShell />}>
        <Route element={<HomeLayer />}>
          <Route index element={null} />
          <Route path="check-in" element={<CheckInPage />} />
        </Route>
        <Route path="insights" element={<PlaceholderPage title="Insights" />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="tracking" element={<Navigate to="/app" replace />} />
        <Route path="habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="decorate" element={<PlaceholderPage title="Decorate" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
