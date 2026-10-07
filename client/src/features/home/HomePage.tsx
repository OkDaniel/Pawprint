import styles from './HomePage.module.css';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import checkInHeart from '../../assets/ui/check-in-heart.png';
import historyGameboy from '../../assets/ui/history-gameboy.png';
import insightsMagnifier from '../../assets/ui/insights-magnifier.png';
import room5 from '../../assets/room/room5.png';
import { CheckInPixelLabel, HistoryPixelLabel, InsightsPixelLabel } from '../../components/PixelGlyph';
import { CatSprite } from './CatSprite';
import { useAuth } from '../../auth/useAuth';
import { DEFAULT_CAT_APPEARANCE, resolveCatAnimation } from './catCatalog';

const CHECK_IN_CELEBRATION_ANIMATION = 'excited';

interface HomeNavigationState {
  justCompletedOnboarding?: boolean;
  justCompletedCheckIn?: boolean;
  catName?: string;
}

export function HomePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const completionState = location.state as HomeNavigationState | null;
  const [showWelcome, setShowWelcome] = useState(Boolean(completionState?.justCompletedOnboarding));
  const [celebratingCheckIn, setCelebratingCheckIn] = useState(Boolean(completionState?.justCompletedCheckIn));
  const catAppearance = user?.catAppearance ?? DEFAULT_CAT_APPEARANCE;

  useEffect(() => {
    if (!completionState?.justCompletedOnboarding && !completionState?.justCompletedCheckIn) return;
    if (completionState.justCompletedOnboarding) setShowWelcome(true);
    if (completionState.justCompletedCheckIn) setCelebratingCheckIn(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [completionState?.justCompletedCheckIn, completionState?.justCompletedOnboarding, location.pathname, navigate]);

  useEffect(() => {
    if (!celebratingCheckIn) return;
    const definition = resolveCatAnimation(catAppearance, CHECK_IN_CELEBRATION_ANIMATION).animation;
    const fallback = window.setTimeout(
      () => setCelebratingCheckIn(false),
      definition.frameCount * definition.frameDurationMs + 250,
    );
    return () => window.clearTimeout(fallback);
  }, [catAppearance, celebratingCheckIn]);

  return (
    <section className={styles.home!} aria-labelledby="cat-room-title">
      {showWelcome && <aside className={styles.welcomeHint!} role="status">
        <span>{user?.catName ?? completionState?.catName ?? 'Mochi'} is settled in. Start with Check In whenever you’re ready.</span>
        <button type="button" aria-label="Dismiss welcome message" onClick={() => setShowWelcome(false)}>×</button>
      </aside>}
      <div className={styles.leftActions!} data-home-action-region="left">
        <Link className={styles.homeAction!} to="/app/check-in">
          <img src={checkInHeart} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>Check In</span>
          <CheckInPixelLabel />
        </Link>
        <Link className={styles.homeAction!} to="/app/insights" data-insights-trigger>
          <img className={styles.insightsIcon!} src={insightsMagnifier} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>Insights</span>
          <InsightsPixelLabel />
        </Link>
      </div>
      <div className={styles.room!}>
        <h1 id="cat-room-title" className={styles.roomTitle!}>Cat Room</h1>
        <div className={styles.scene!} data-testid="cat-room-scene">
          <img className={styles.roomBackground!} src={room5} alt="" aria-hidden="true" data-testid="room-background" />
          {/* Future furniture and cat positions should use this room-relative layer. */}
          <div className={styles.objectLayer!}>
            <div className={styles.catPosition!}>
              <CatSprite
                appearance={catAppearance}
                animation={celebratingCheckIn ? CHECK_IN_CELEBRATION_ANIMATION : 'idle'}
                loop={!celebratingCheckIn}
                onAnimationEnd={() => setCelebratingCheckIn(false)}
              />
            </div>
          </div>
          {celebratingCheckIn && <p className={styles.checkInCelebration!} role="status">
            Check-In complete. {user?.catName ?? 'Mochi'} is cheering for you.
          </p>}
        </div>
      </div>
      <div className={styles.rightActions!} data-home-action-region="right">
        <Link className={styles.homeAction!} to="/app/history" data-history-trigger>
          <img src={historyGameboy} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>History</span>
          <HistoryPixelLabel />
        </Link>
      </div>
    </section>
  );
}
