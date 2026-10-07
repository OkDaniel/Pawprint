import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AuthPage } from '../features/auth/AuthPage';
import { CheckInPage } from '../features/checkIn/CheckInPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { SleepEditPage } from '../features/history/SleepEditPage';
import { HomeLayer } from '../features/home/HomeLayer';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { RequiresCompletedOnboarding, RequiresOnboarding } from '../auth/OnboardingRoutes';
import { isOnboardingPreviewEnabled } from './onboardingPreviewMode';
import { InsightsModal } from '../features/insights/InsightsModal';

const onboardingPreviewEnabled = isOnboardingPreviewEnabled(import.meta.env.MODE);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedRoute />}>
      {onboardingPreviewEnabled && <Route path="/onboarding-preview" element={<OnboardingPage mode="preview" />} />}
      <Route element={<RequiresOnboarding />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
      <Route element={<RequiresCompletedOnboarding />}>
      <Route path="/app" element={<AppShell />}>
        <Route element={<HomeLayer />}>
          <Route index element={null} />
          <Route path="check-in" element={<CheckInPage />} />
          <Route path="check-in/:checkInId/edit" element={<CheckInPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="insights" element={<InsightsModal />} />
        </Route>
        <Route path="sleep/:logicalDate/edit" element={<SleepEditPage />} />
        <Route path="tracking" element={<Navigate to="/app" replace />} />
        <Route path="habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="decorate" element={<PlaceholderPage title="Decorate" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
