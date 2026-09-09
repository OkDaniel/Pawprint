import { useEffect, useState } from 'react';
import type { CheckIn, CheckInListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import styles from './HistoryPage.module.css';

const moodLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };

export function HistoryPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<CheckInListResponse>('/api/check-ins').then((result) => setCheckIns(result.checkIns))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load history.'))
      .finally(() => setLoading(false));
  }, []);
  return <section className={styles.page!}><h1>Recent Check-Ins</h1>
    {loading && <p role="status">Loading…</p>}{error && <p className={styles.error!} role="alert">{error}</p>}
    {!loading && !error && checkIns.length === 0 && <p>No check-ins yet. Your saved entries will appear here.</p>}
    <ol className={styles.list!}>{checkIns.map((checkIn) => <li className={styles.entry!} key={checkIn.id}>
      <time dateTime={checkIn.occurredAt}>{formatDate(checkIn.occurredAt)}</time>
      {checkIn.mood !== null && <p>Mood: {moodLabels[checkIn.mood]} ({checkIn.mood}/5)</p>}
      {checkIn.feelings.length > 0 && <p>Feelings: {checkIn.feelings.map((feeling) => feeling.name).join(', ')}</p>}
      {checkIn.pain !== null && <p>Pain: {checkIn.pain}/10</p>}
      {checkIn.symptoms.length > 0 && <div><p>Symptoms:</p><ul>{checkIn.symptoms.map((symptom) => <li key={symptom.symptomId}>{symptom.name}: {symptom.severity}/4</li>)}</ul></div>}
      {checkIn.factors.length > 0 && <div><p>Factors:</p><ul>{checkIn.factors.map((factor) => <li key={factor.id}>{factor.name}{factor.intensity === null ? ' — legacy/no intensity' : ` — ${['A little', 'Medium', 'A lot'][factor.intensity - 1]}`}</li>)}</ul></div>}
    </li>)}</ol>
  </section>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
