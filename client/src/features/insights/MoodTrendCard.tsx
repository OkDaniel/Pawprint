import type { MoodTrendResponse } from '@capstone/shared';
import { MoodTrendChart } from './MoodTrendChart';
import { formatMood } from './moodTrendChartModel';
import styles from './InsightsPage.module.css';

interface MoodTrendCardProps {
  trend: MoodTrendResponse;
}

export function MoodTrendCard({ trend }: MoodTrendCardProps) {
  const { summary } = trend;
  return (
    <section className={styles.card!} aria-labelledby="mood-trend-title">
      <header className={styles.cardHeader!}>
        <div>
          <h2 id="mood-trend-title">Mood over the last 30 days</h2>
          <p>Daily average from your Check-Ins</p>
        </div>
      </header>
      {summary.totalCheckIns === 0 ? <div className={styles.emptyState!}>
        <h3>No Mood data yet</h3>
        <p>Complete a Check-In and your Mood trend will start appearing here.</p>
      </div> : <>
        <dl className={styles.summary!}>
          <div><dt>Average Mood</dt><dd>{summary.averageMood == null ? '—' : `${formatMood(summary.averageMood)} / 5`}</dd></div>
          <div><dt>Days tracked</dt><dd>{summary.trackedDays} / 30</dd></div>
          <div><dt>Check-Ins</dt><dd>{summary.totalCheckIns}</dd></div>
        </dl>
        {summary.trackedDays <= 2 && <p className={styles.sparseMessage!}>Keep checking in to build out your 30-day view.</p>}
        <MoodTrendChart points={trend.points} trackedDays={summary.trackedDays} averageMood={summary.averageMood} />
        <p className={styles.contextNote!}>This view summarizes what you recorded; it does not identify causes.</p>
      </>}
    </section>
  );
}
