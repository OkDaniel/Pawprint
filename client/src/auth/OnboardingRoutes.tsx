import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function RequiresOnboarding() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const completing = Boolean((location.state as { completingOnboarding?: boolean } | null)?.completingOnboarding);
  return user.onboardingCompleted
    ? <Navigate to="/app" replace state={completing ? { justCompletedOnboarding: true, catName: user.catName } : null} />
    : <Outlet />;
}

export function RequiresCompletedOnboarding() {
  const { user } = useAuth();
  if (!user) return null;
  return user.onboardingCompleted ? <Outlet /> : <Navigate to="/onboarding" replace />;
}
