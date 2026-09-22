import { useEffect, useState } from 'react';
import type { CheckIn, CheckInListResponse, SleepEntry, SleepListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import styles from './HistoryPage.module.css';

const moodLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };

export function HistoryPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([apiRequest<CheckInListResponse>('/api/check-ins'), apiRequest<SleepListResponse>('/api/sleep')])
      .then(([checkInResult, sleepResult]) => { setCheckIns(checkInResult.checkIns); setSleepEntries(sleepResult.sleepEntries); })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load history.'))
      .finally(() => setLoading(false));
  }, []);
  const dates = [...new Set([...checkIns.map((item) => item.logicalDate), ...sleepEntries.map((item) => item.logicalDate)])].sort().reverse();
  return <section className={styles.page!}><h1>History</h1>
    {loading && <p role="status">Loading…</p>}{error && <p className={styles.error!} role="alert">{error}</p>}
    {!loading && !error && dates.length === 0 && <p>No history yet. Your saved entries will appear here.</p>}
    <div className={styles.days!}>{dates.map((date) => <section className={styles.day!} key={date}><h2>{formatLogicalDate(date)}</h2>
      {sleepEntries.filter((sleep) => sleep.logicalDate === date).map((sleep) => <SleepCard key={sleep.id} sleep={sleep} />)}
      <ol className={styles.list!}>{checkIns.filter((checkIn) => checkIn.logicalDate === date).map((checkIn) => <li className={styles.entry!} key={checkIn.id}>
      <time dateTime={checkIn.occurredAt}>{formatDate(checkIn.occurredAt)}</time>
      {checkIn.mood !== null && <p>Mood: {moodLabels[checkIn.mood]} ({checkIn.mood}/5)</p>}
      {checkIn.feelings.length > 0 && <p>Feelings: {checkIn.feelings.map((feeling) => feeling.name).join(', ')}</p>}
      {checkIn.pain !== null && <p>Pain: {checkIn.pain}/10</p>}
      {checkIn.symptoms.length > 0 && <div><p>Symptoms:</p><ul>{checkIn.symptoms.map((symptom) => <li key={symptom.symptomId}>{symptom.name}: {symptom.severity}/4</li>)}</ul></div>}
      {checkIn.factors.length > 0 && <div><p>Factors:</p><ul>{checkIn.factors.map((factor) => <li key={factor.id}>{factor.name}{factor.intensity === null ? ' — legacy/no intensity' : ` — ${['A little', 'Medium', 'A lot'][factor.intensity - 1]}`}</li>)}</ul></div>}
      </li>)}</ol>
    </section>)}</div>
  </section>;
}

function SleepCard({ sleep }: { sleep: SleepEntry }) {
  const qualityLabels = ['Very Poor', 'Poor', 'Okay', 'Good', 'Great'];
  return <article className={styles.sleepEntry!}><h3>Sleep</h3>
    {sleep.durationMinutes !== null && <p>{formatDuration(sleep.durationMinutes)}</p>}
    {sleep.qualityScore !== null && <p>Quality: {qualityLabels[sleep.qualityScore - 1]} ({sleep.qualityScore}/5)</p>}
    {(sleep.bedtime !== null || sleep.wakeTime !== null) && <p>{sleep.bedtime ? formatClockTime(sleep.bedtime) : 'Not entered'} – {sleep.wakeTime ? formatClockTime(sleep.wakeTime) : 'Not entered'}</p>}
  </article>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatLogicalDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours > 0 ? `${hours}h` : ''}${hours > 0 && minutes > 0 ? ' ' : ''}${minutes > 0 ? `${minutes}m` : ''}`;
}

function formatClockTime(value: string): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hours, minutes));
}
