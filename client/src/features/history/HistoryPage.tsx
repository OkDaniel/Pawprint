import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CheckIn, CheckInListResponse, SleepEntry, SleepListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { formatDateTyping, parseUserDate } from './dateInput';
import styles from './HistoryPage.module.css';

const moodLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };

export function HistoryPage() {
  const navigate = useNavigate();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<'all' | '7' | '30' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [dateError, setDateError] = useState('');
  const close = useCallback(() => {
    navigate('/app');
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-history-trigger]')?.focus());
  }, [navigate]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);
  useEffect(() => {
    setLoading(true); setError('');
    const query = buildRangeQuery(range, appliedStartDate, appliedEndDate);
    if (range === 'custom' && (!appliedStartDate || !appliedEndDate)) { setLoading(false); return; }
    Promise.all([apiRequest<CheckInListResponse>(`/api/check-ins${query}`), apiRequest<SleepListResponse>(`/api/sleep${query}`)])
      .then(([checkInResult, sleepResult]) => { setCheckIns(checkInResult.checkIns); setSleepEntries(sleepResult.sleepEntries); })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load history.'))
      .finally(() => setLoading(false));
  }, [range, appliedStartDate, appliedEndDate]);
  function applyCustomRange(event: React.FormEvent) {
    event.preventDefault();
    const normalizedStart = parseUserDate(startDate);
    const normalizedEnd = parseUserDate(endDate);
    if (!normalizedStart || !normalizedEnd) { setDateError('Enter real dates as M/D/YYYY.'); return; }
    if (normalizedStart > normalizedEnd) { setDateError('Start date must be on or before end date.'); return; }
    setDateError(''); setAppliedStartDate(normalizedStart); setAppliedEndDate(normalizedEnd);
  }
  const dates = [...new Set([...checkIns.map((item) => item.logicalDate), ...sleepEntries.map((item) => item.logicalDate)])].sort().reverse();
  return <div className={styles.backdrop!} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className={styles.dialog!} role="dialog" aria-modal="true" aria-labelledby="history-title">
    <header className={styles.modalHeader!}><div className={styles.titleRow!}><h1 id="history-title">History</h1><button ref={closeButton} className={styles.close!} type="button" aria-label="Close History" onClick={close}>×</button></div><div className={styles.rangeControls!} aria-label="History date range">
    <label>Show<select value={range} onChange={(event) => setRange(event.target.value as typeof range)}><option value="all">All</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="custom">Custom date range</option></select></label>
    {range === 'custom' && <form className={styles.customDates!} onSubmit={applyCustomRange}><label>Start date<input type="text" inputMode="numeric" placeholder="1/5/2026" value={startDate} onChange={(event) => setStartDate(formatDateTyping(event.target.value, (event.nativeEvent as InputEvent).inputType, event.target.selectionStart === event.target.value.length))} /></label><label>End date<input type="text" inputMode="numeric" placeholder="9/22/2026" value={endDate} onChange={(event) => setEndDate(formatDateTyping(event.target.value, (event.nativeEvent as InputEvent).inputType, event.target.selectionStart === event.target.value.length))} /></label><button type="submit">Apply</button></form>}
  </div></header><div className={styles.historyScroll!}>
    {dateError && <p className={styles.error!} role="alert">{dateError}</p>}
    {loading && <p role="status">Loading…</p>}{error && <p className={styles.error!} role="alert">{error}</p>}
    {!loading && !error && dates.length === 0 && <p>No history yet. Your saved entries will appear here.</p>}
    <div className={styles.days!}>{dates.map((date) => <section className={styles.day!} key={date}><h2>{formatLogicalDate(date)}</h2>
      {sleepEntries.filter((sleep) => sleep.logicalDate === date).map((sleep) => <SleepCard key={sleep.id} sleep={sleep} />)}
      <ol className={styles.list!}>{checkIns.filter((checkIn) => checkIn.logicalDate === date).map((checkIn) => <li className={styles.entry!} key={checkIn.id}>
      <div className={styles.entryHeader!}><time dateTime={checkIn.occurredAt}>{formatDate(checkIn.occurredAt)}</time><Link to={`/app/check-in/${checkIn.id}/edit`}>Edit</Link></div>
      {checkIn.mood !== null && <p>Mood: {moodLabels[checkIn.mood]} ({checkIn.mood}/5)</p>}
      {checkIn.feelings.length > 0 && <p>Feelings: {checkIn.feelings.map((feeling) => feeling.name).join(', ')}</p>}
      {checkIn.pain !== null && <p>Pain: {checkIn.pain}/10</p>}
      {checkIn.symptoms.length > 0 && <div><p>Symptoms:</p><ul>{checkIn.symptoms.map((symptom) => <li key={symptom.symptomId}>{symptom.name}: {symptom.severity}/4</li>)}</ul></div>}
      {checkIn.factors.length > 0 && <div><p>Factors:</p><ul>{checkIn.factors.map((factor) => <li key={factor.id}>{factor.name}{factor.intensity === null ? ' — legacy/no intensity' : ` — ${['A little', 'Medium', 'A lot'][factor.intensity - 1]}`}</li>)}</ul></div>}
      </li>)}</ol>
    </section>)}</div>
    </div></section>
  </div>;
}

function buildRangeQuery(range: 'all' | '7' | '30' | 'custom', startDate: string, endDate: string): string {
  if (range === 'all') return '';
  if (range === 'custom') return `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (Number(range) - 1));
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return `?startDate=${date(start)}&endDate=${date(end)}`;
}

function SleepCard({ sleep }: { sleep: SleepEntry }) {
  const qualityLabels = ['Very Poor', 'Poor', 'Okay', 'Good', 'Great'];
  return <article className={styles.sleepEntry!}><div className={styles.entryHeader!}><h3>Sleep</h3><Link to={`/app/sleep/${sleep.logicalDate}/edit`}>Edit</Link></div>
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
