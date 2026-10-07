import { useCallback, useEffect, useState } from 'react';
import type { MoodTrendResponse } from '@capstone/shared';
import { getMoodTrend } from './insightsApi';
import { MoodTrendCard } from './MoodTrendCard';
import styles from './InsightsPage.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; trend: MoodTrendResponse }
  | { status: 'error' };

export function InsightsPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setLoadState({ status: 'loading' });
    try {
      setLoadState({ status: 'loaded', trend: await getMoodTrend() });
    } catch {
      setLoadState({ status: 'error' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className={styles.page!}>
      {loadState.status === 'loading' && <section className={styles.card!} aria-label="Mood over the last 30 days">
        <div className={styles.loading!} role="status">Loading your Mood trend…</div>
      </section>}
      {loadState.status === 'error' && <section className={styles.card!} aria-label="Mood trend error">
        <div className={styles.errorState!} role="alert">
          <h2>We couldn’t load your Mood trend.</h2>
          <p>Please try again.</p>
          <button type="button" onClick={() => { void load(); }}>Retry</button>
        </div>
      </section>}
      {loadState.status === 'loaded' && <MoodTrendCard trend={loadState.trend} />}
    </section>
  );
}
