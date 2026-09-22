import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CheckInResponse, Factor, FactorListResponse, Feeling, FeelingListResponse, SleepCurrentResponse, SleepEntry, SleepInput, Symptom, SymptomCategory, SymptomListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { CustomizationDialog } from './CustomizationDialog';
import { FactorIntensityControl } from './FactorIntensityControl';
import styles from './CheckInPage.module.css';
import moodVeryLow from '../../assets/ui/mood-very-low.png';
import moodLow from '../../assets/ui/mood-low.png';
import moodOkay from '../../assets/ui/mood-okay.png';
import moodGood from '../../assets/ui/mood-good.png';
import moodGreat from '../../assets/ui/mood-great.png';

const steps = ['Mood', 'Pain', 'Physical Other', 'Mental', 'Cognitive', 'Sleep', 'Factors'] as const;
const moods = [
  { value: 1, label: 'Very Low', sprite: moodVeryLow },
  { value: 2, label: 'Low', sprite: moodLow },
  { value: 3, label: 'Okay', sprite: moodOkay },
  { value: 4, label: 'Good', sprite: moodGood },
  { value: 5, label: 'Great', sprite: moodGreat },
] as const;
const severityLabels = ['None', 'Mild', 'Moderate', 'Severe', 'Very Severe'];
type Ratings = Record<number, number>;

export function CheckInPage() {
  const navigate = useNavigate();
  const closeButton = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [feelingIds, setFeelingIds] = useState<number[]>([]);
  const [pain, setPain] = useState<number | null>(null);
  const [symptomRatings, setSymptomRatings] = useState<Ratings>({});
  const [factorRatings, setFactorRatings] = useState<Ratings>({});
  const [feelings, setFeelings] = useState<Feeling[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [existingSleep, setExistingSleep] = useState<SleepEntry | null>(null);
  const [sleepTouched, setSleepTouched] = useState(false);
  const [sleepHours, setSleepHours] = useState('');
  const [sleepMinutes, setSleepMinutes] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [customizing, setCustomizing] = useState<'feelings' | 'factors' | SymptomCategory | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<FeelingListResponse>('/api/feelings'),
      ...(['Physical Pain', 'Physical Other', 'Mental', 'Cognitive'] as SymptomCategory[]).map((category) =>
        apiRequest<SymptomListResponse>(`/api/symptoms?category=${encodeURIComponent(category)}`)),
      apiRequest<FactorListResponse>('/api/factors'),
      apiRequest<SleepCurrentResponse>('/api/sleep/current'),
    ]).then(([feelingResult, ...rest]) => {
      setFeelings(feelingResult.feelings);
      setSymptoms(rest.slice(0, 4).flatMap((result) => (result as SymptomListResponse).symptoms));
      setFactors((rest[4] as FactorListResponse).factors);
      const currentSleep = (rest[5] as SleepCurrentResponse).sleep;
      setExistingSleep(currentSleep);
      if (currentSleep) {
        setSleepHours(currentSleep.durationMinutes == null ? '' : String(Math.floor(currentSleep.durationMinutes / 60)));
        setSleepMinutes(currentSleep.durationMinutes == null ? '' : String(currentSleep.durationMinutes % 60));
        setSleepQuality(currentSleep.qualityScore);
        setBedtime(currentSleep.bedtime ?? '');
        setWakeTime(currentSleep.wakeTime ?? '');
      }
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Check-In options.'));
    closeButton.current?.focus();
  }, []);

  const dirty = mood !== null || pain !== null || feelingIds.length > 0 || Object.keys(symptomRatings).length > 0 || Object.keys(factorRatings).length > 0 || sleepTouched;
  function close() {
    if (!dirty || window.confirm('Discard this unfinished check-in?')) navigate('/app');
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !customizing) close(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });

  const selectedSymptoms = useMemo(() => Object.entries(symptomRatings).map(([symptomId, severity]) => ({ symptomId: Number(symptomId), severity })), [symptomRatings]);
  async function save() {
    if (mood === null || saving) return;
    setSaving(true); setError('');
    try {
      const sleep = buildSleepInput(sleepHours, sleepMinutes, sleepQuality, bedtime, wakeTime);
      await apiRequest<CheckInResponse>('/api/check-ins', { method: 'POST', body: JSON.stringify({
        mood, feelingIds, pain, symptoms: selectedSymptoms,
        factors: Object.entries(factorRatings).map(([factorId, intensity]) => ({ factorId: Number(factorId), intensity })),
        ...(sleepTouched && sleep ? { sleep } : {}),
      }) });
      setSaved(true);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      navigate('/app', { replace: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save this Check-In.'); setSaving(false); }
  }

  function updateSymptoms(category: SymptomCategory, updated: Symptom[]) {
    setSymptoms((current) => [...current.filter((item) => item.category !== category), ...updated]);
  }

  return <div className={styles.backdrop!} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className={styles.dialog!} role="dialog" aria-modal="true" aria-labelledby="check-in-title">
      <header className={styles.header!}>
        <div><p className={styles.progressText!}>Step {step + 1} of {steps.length}</p><h1 id="check-in-title">{steps[step]}</h1></div>
        <button ref={closeButton} className={styles.close!} type="button" aria-label="Close Check-In" onClick={close}>×</button>
      </header>
      <div className={styles.progressTrack!}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      <div className={styles.content!}>
        {step === 0 && <MoodStep mood={mood} setMood={setMood} feelings={feelings.filter((item) => item.isPinned)} feelingIds={feelingIds} setFeelingIds={setFeelingIds} customize={() => setCustomizing('feelings')} />}
        {step === 1 && <><DiscreteRow label="Generalized Pain" values={11} selected={pain} onSelect={setPain} labels={[]} compact /><SectionTitle title="Physical Pain" edit={() => setCustomizing('Physical Pain')} /><SymptomRows items={symptoms.filter((item) => item.category === 'Physical Pain' && item.isPinned)} ratings={symptomRatings} setRatings={setSymptomRatings} /></>}
        {step >= 2 && step <= 4 && (() => { const category = steps[step] as SymptomCategory; return <><SectionTitle title={category} edit={() => setCustomizing(category)} /><SymptomRows items={symptoms.filter((item) => item.category === category && item.isPinned)} ratings={symptomRatings} setRatings={setSymptomRatings} /></>; })()}
        {step === 5 && <SleepStep existingSleep={existingSleep} hours={sleepHours} minutes={sleepMinutes} quality={sleepQuality} bedtime={bedtime} wakeTime={wakeTime} onHours={(value) => { setSleepTouched(true); setSleepHours(value); }} onMinutes={(value) => { setSleepTouched(true); setSleepMinutes(value); }} onQuality={(value) => { setSleepTouched(true); setSleepQuality(value); }} onBedtime={(value) => { setSleepTouched(true); setBedtime(value); }} onWakeTime={(value) => { setSleepTouched(true); setWakeTime(value); }} />}
        {step === 6 && <FactorStep factors={factors.filter((factor) => factor.isPinned)} ratings={factorRatings} setRatings={setFactorRatings} customize={() => setCustomizing('factors')} />}
      </div>
      {error && <p className={styles.error!} role="alert">{error}</p>}
      {saved && <p className={styles.success!} role="status">Check-In saved. Returning home…</p>}
      <footer className={styles.footer!}>
        <button type="button" className={styles.secondary!} disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Back</button>
        {step < steps.length - 1
          ? <button type="button" className={styles.primary!} disabled={(step === 0 && mood === null) || saving} onClick={() => setStep((current) => current + 1)}>Next</button>
          : <button type="button" className={styles.primary!} disabled={mood === null || saving} onClick={save}>{saving ? 'Saving…' : 'Save Check-In'}</button>}
      </footer>
    </section>
    {customizing === 'feelings' && <CustomizationDialog kind="feelings" items={feelings} onChange={setFeelings} onClose={() => setCustomizing(null)} />}
    {customizing === 'factors' && <CustomizationDialog kind="factors" items={factors} onChange={setFactors} onClose={() => setCustomizing(null)} />}
    {customizing && customizing !== 'feelings' && customizing !== 'factors' && <CustomizationDialog kind="symptoms" category={customizing} items={symptoms.filter((item) => item.category === customizing)} onChange={(items) => updateSymptoms(customizing, items)} onClose={() => setCustomizing(null)} />}
  </div>;
}

function SleepStep({ existingSleep, hours, minutes, quality, bedtime, wakeTime, onHours, onMinutes, onQuality, onBedtime, onWakeTime }: {
  existingSleep: SleepEntry | null; hours: string; minutes: string; quality: number | null; bedtime: string; wakeTime: string;
  onHours(value: string): void; onMinutes(value: string): void; onQuality(value: number | null): void; onBedtime(value: string): void; onWakeTime(value: string): void;
}) {
  const qualityLabels = ['Very Poor', 'Poor', 'Okay', 'Good', 'Great'];
  return <div className={styles.sleepStep!}>
    <div><h2>How did you sleep?</h2><p className={styles.hint!}>{existingSleep ? 'Your Sleep for this tracking day is ready to update.' : 'Add only what you know. You can leave this step blank.'}</p></div>
    <fieldset className={styles.sleepGroup!}><legend>Sleep duration</legend><div className={styles.durationInputs!}>
      <label>Hours<input type="number" min="0" max="24" inputMode="numeric" value={hours} onChange={(event) => onHours(event.target.value)} /></label>
      <label>Minutes<input type="number" min="0" max="59" inputMode="numeric" value={minutes} onChange={(event) => onMinutes(event.target.value)} /></label>
    </div></fieldset>
    <fieldset className={styles.sleepGroup!}><legend>Sleep quality</legend><div className={styles.qualityOptions!}>{qualityLabels.map((label, index) => {
      const value = index + 1;
      return <button type="button" key={value} aria-pressed={quality === value} className={quality === value ? styles.selected : ''} onClick={() => onQuality(quality === value ? null : value)}><strong>{label}</strong><span>{value}/5</span></button>;
    })}</div></fieldset>
    <fieldset className={styles.sleepGroup!}><legend>Clock times</legend><p className={styles.hint!}>Local clock times only. Overnight ranges such as 11:30 PM to 7:00 AM are valid.</p><div className={styles.timeInputs!}>
      <label>Bedtime<input type="time" value={bedtime} onChange={(event) => onBedtime(event.target.value)} /></label>
      <label>Wake time<input type="time" value={wakeTime} onChange={(event) => onWakeTime(event.target.value)} /></label>
    </div></fieldset>
  </div>;
}

function buildSleepInput(hours: string, minutes: string, qualityScore: number | null, bedtime: string, wakeTime: string): SleepInput | undefined {
  const hasDuration = hours !== '' || minutes !== '';
  const durationMinutes = hasDuration ? Number(hours || 0) * 60 + Number(minutes || 0) : null;
  if (!hasDuration && qualityScore === null && bedtime === '' && wakeTime === '') return undefined;
  return { durationMinutes, qualityScore, bedtime: bedtime || null, wakeTime: wakeTime || null };
}

function MoodStep({ mood, setMood, feelings, feelingIds, setFeelingIds, customize }: { mood: number | null; setMood(value: number): void; feelings: Feeling[]; feelingIds: number[]; setFeelingIds(value: number[]): void; customize(): void }) {
  return <><h2>How are you feeling?</h2><div className={styles.moodGrid!}>{moods.map(({ value, label, sprite }) => <button type="button" key={value} aria-label={`${label}, mood ${value} of 5`} aria-pressed={mood === value} className={mood === value ? styles.selected : ''} onClick={() => setMood(value)}><img className={styles.moodSprite!} src={sprite} alt="" aria-hidden="true" /><strong>{label}</strong></button>)}</div>
    {mood !== null && <><SectionTitle title="Add feelings" edit={customize} plus /><div className={styles.chips!}>{feelings.map((feeling) => <button type="button" key={feeling.id} aria-pressed={feelingIds.includes(feeling.id)} className={feelingIds.includes(feeling.id) ? styles.selected : ''} onClick={() => setFeelingIds(feelingIds.includes(feeling.id) ? feelingIds.filter((id) => id !== feeling.id) : [...feelingIds, feeling.id])}>{feeling.name}</button>)}</div></>}
  </>;
}

function SectionTitle({ title, edit, plus = false }: { title: string; edit(): void; plus?: boolean }) { return <div className={styles.sectionTitle!}><h2>{title}</h2><button type="button" onClick={edit}>{plus ? '+' : 'Edit'}</button></div>; }

function SymptomRows({ items, ratings, setRatings }: { items: Symptom[]; ratings: Ratings; setRatings(value: Ratings): void }) {
  if (items.length === 0) return <p className={styles.hint!}>Your quick list is empty. Choose Edit to add symptoms.</p>;
  return <div className={styles.rows!}>{items.map((item) => <DiscreteRow key={item.id} label={item.name} values={5} selected={ratings[item.id] ?? null} labels={severityLabels} onSelect={(value) => { const next = { ...ratings }; if (value === null) delete next[item.id]; else next[item.id] = value; setRatings(next); }} />)}</div>;
}

function DiscreteRow({ label, values, selected, onSelect, labels, compact = false }: { label: string; values: number; selected: number | null; onSelect(value: number | null): void; labels: string[]; compact?: boolean }) {
  return <div className={`${styles.ratingRow!} ${compact ? styles.compactRatingRow! : ''}`} role="group" aria-label={label}><div className={styles.ratingLabel!}><strong>{label}</strong>{selected !== null && labels[selected] && <small>{labels[selected]}</small>}</div><div className={styles.ratingButtons!}>{Array.from({ length: values }, (_, value) => <button type="button" key={value} aria-label={`${label}: ${value}${labels[value] ? `, ${labels[value]}` : ''}`} aria-pressed={selected === value} className={selected === value ? styles.selected : ''} onClick={() => onSelect(selected === value ? null : value)}>{value}</button>)}</div></div>;
}

function FactorStep({ factors, ratings, setRatings, customize }: { factors: Factor[]; ratings: Ratings; setRatings(value: Ratings): void; customize(): void }) {
  return <><div className={styles.sectionTitle!}><div><h2>What's been going on?</h2><p className={styles.hint!}>Choose how much each factor was present.</p></div><button type="button" onClick={customize}>Edit Factors</button></div><div className={styles.factorRows!}>{factors.map((factor) => <div className={styles.factorRow!} key={factor.id}><strong>{factor.name}</strong><FactorIntensityControl factorName={factor.name} selected={ratings[factor.id] ?? null} onChange={(value) => { const next = { ...ratings }; if (value === null) delete next[factor.id]; else next[factor.id] = value; setRatings(next); }} /></div>)}</div>{factors.length === 0 && <p className={styles.hint!}>Your quick list is empty. Choose Edit Factors to add some.</p>}</>;
}
