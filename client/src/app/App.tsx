import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../features/home/HomePage';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="insights" element={<PlaceholderPage title="Insights" />} />
        <Route path="history" element={<PlaceholderPage title="History" />} />
        <Route path="tracking" element={<PlaceholderPage title="Tracking" />} />
        <Route path="habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="decorate" element={<PlaceholderPage title="Decorate" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

