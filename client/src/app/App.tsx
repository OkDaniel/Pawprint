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
import { GameBoundary } from '../features/room/GameBoundary';
import { lazy, Suspense } from 'react';

const onboardingPreviewEnabled = isOnboardingPreviewEnabled(import.meta.env.MODE);
const StoreModal = lazy(() => import('../features/store/StoreModal').then(module => ({ default: module.StoreModal })));
// Compile-time gate: Rollup must discard the lazy module AND its assets in production.
const BuildPreviewPage = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test'
  ? lazy(() => import('../features/buildPreview/BuildPreviewPage'))
  : null;

export function App() {
  return (
    <Routes>
      {BuildPreviewPage && <Route path="/build-preview" element={<Suspense fallback={<p>Loading development sandbox…</p>}><BuildPreviewPage /></Suspense>} />}
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
          <Route path="store" element={<GameBoundary><Suspense fallback={<p role="status">Opening Store…</p>}><StoreModal /></Suspense></GameBoundary>} />
        </Route>
        <Route path="sleep/:logicalDate/edit" element={<SleepEditPage />} />
        <Route path="tracking" element={<Navigate to="/app" replace />} />
        <Route path="habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="decorate" element={<Navigate to="/app/store" replace />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
