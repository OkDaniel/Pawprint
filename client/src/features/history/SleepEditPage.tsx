import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SleepEntry, SleepResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { SleepForm } from '../checkIn/CheckInPage';
import { buildSleepInput } from '../checkIn/sleepDraft';
import styles from './SleepEditPage.module.css';

export function SleepEditPage() {
  const { logicalDate = '' } = useParams();
  const navigate = useNavigate();
  const [sleep, setSleep] = useState<SleepEntry | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [bedtimeValid, setBedtimeValid] = useState(true);
  const [wakeTimeValid, setWakeTimeValid] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<SleepResponse>(`/api/sleep/${logicalDate}`)
      .then(({ sleep: entry }) => {
        setSleep(entry);
        setQuality(entry.qualityScore);
        setBedtime(entry.bedtime ?? '');
        setWakeTime(entry.wakeTime ?? '');
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Sleep.'));
  }, [logicalDate]);

  async function save() {
    if (saving || !bedtimeValid || !wakeTimeValid) return;
    const input = buildSleepInput(quality, bedtime, wakeTime);
    if (!input) { setError('Keep at least one Sleep value. Deleting a Sleep entry is not available yet.'); return; }
    setSaving(true); setError('');
    try {
      await apiRequest<SleepResponse>(`/api/sleep/${logicalDate}`, { method: 'PUT', body: JSON.stringify(input) });
      navigate('/app/history', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update Sleep.');
      setSaving(false);
    }
  }

  return <section className={styles.page!}>
    <header><div><p className={styles.eyebrow!}>Daily Sleep</p><h1>Edit {formatLogicalDate(logicalDate)}</h1></div><Link to="/app/history">Cancel</Link></header>
    {error && <p className={styles.error!} role="alert">{error}</p>}
    {!sleep && !error && <p role="status">Loading Sleep…</p>}
    {sleep && <div className={styles.form!}>
      <SleepForm existingSleep={sleep} quality={quality} bedtime={bedtime} wakeTime={wakeTime} bedtimeValid={bedtimeValid} wakeTimeValid={wakeTimeValid} onQuality={setQuality} onBedtime={setBedtime} onWakeTime={setWakeTime} onBedtimeValidity={setBedtimeValid} onWakeTimeValidity={setWakeTimeValid} />
      <div className={styles.actions!}><Link to="/app/history">Cancel</Link><button type="button" disabled={saving || !bedtimeValid || !wakeTimeValid} onClick={save}>{saving ? 'Saving…' : 'Save Sleep'}</button></div>
    </div>}
  </section>;
}

function formatLogicalDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
