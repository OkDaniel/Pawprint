import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deriveSleepDurationMinutes, to24HourTime, type CheckInResponse, type Factor, type FactorListResponse, type Feeling, type FeelingListResponse, type SleepCurrentResponse, type SleepEntry, type Symptom, type SymptomCategory, type SymptomListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { CustomizationDialog } from './CustomizationDialog';
import { FactorIntensityControl } from './FactorIntensityControl';
import styles from './CheckInPage.module.css';
import moodVeryLow from '../../assets/ui/mood-very-low.png';
import moodLow from '../../assets/ui/mood-low.png';
import moodOkay from '../../assets/ui/mood-okay.png';
import moodGood from '../../assets/ui/mood-good.png';
import moodGreat from '../../assets/ui/mood-great.png';
import { buildSleepInput } from './sleepDraft';

const createSteps = ['Mood', 'Pain & Symptoms', 'Sleep', 'Factors'] as const;
const editSteps = ['Mood', 'Pain & Symptoms', 'Factors'] as const;
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
  const { checkInId } = useParams();
  const editing = checkInId !== undefined;
  const steps = editing ? editSteps : createSteps;
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
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [bedtimeValid, setBedtimeValid] = useState(true);
  const [wakeTimeValid, setWakeTimeValid] = useState(true);
  const [customizing, setCustomizing] = useState<'feelings' | 'factors' | SymptomCategory | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<FeelingListResponse>('/api/feelings'),
      ...(['Physical Pain', 'Physical Other', 'Mental', 'Cognitive'] as SymptomCategory[]).map((category) =>
        apiRequest<SymptomListResponse>(`/api/symptoms?category=${encodeURIComponent(category)}`)),
      apiRequest<FactorListResponse>('/api/factors'),
      editing ? Promise.resolve({ sleep: null }) : apiRequest<SleepCurrentResponse>('/api/sleep/current'),
      editing ? apiRequest<CheckInResponse>(`/api/check-ins/${checkInId}`) : Promise.resolve(null),
    ]).then(([feelingResult, ...rest]) => {
      setFeelings(feelingResult.feelings);
      setSymptoms(rest.slice(0, 4).flatMap((result) => (result as SymptomListResponse).symptoms));
      setFactors((rest[4] as FactorListResponse).factors);
      const currentSleep = (rest[5] as SleepCurrentResponse).sleep;
      setExistingSleep(currentSleep);
      if (currentSleep) {
        setSleepQuality(currentSleep.qualityScore);
        setBedtime(currentSleep.bedtime ?? '');
        setWakeTime(currentSleep.wakeTime ?? '');
      }
      const existingCheckIn = rest[6] as CheckInResponse | null;
      if (existingCheckIn) {
        setFeelings((current) => mergeById(current, existingCheckIn.checkIn.feelings));
        setSymptoms((current) => mergeById(current, existingCheckIn.checkIn.symptoms.map((item) => ({ id: item.symptomId, slug: null, name: item.name, category: item.category, isBuiltin: false, isPinned: true }))));
        setFactors((current) => mergeById(current, existingCheckIn.checkIn.factors));
        setMood(existingCheckIn.checkIn.mood);
        setFeelingIds(existingCheckIn.checkIn.feelings.map(({ id }) => id));
        setPain(existingCheckIn.checkIn.pain);
        setSymptomRatings(Object.fromEntries(existingCheckIn.checkIn.symptoms.map(({ symptomId, severity }) => [symptomId, severity])));
        setFactorRatings(Object.fromEntries(existingCheckIn.checkIn.factors.filter(({ intensity }) => intensity !== null).map(({ id, intensity }) => [id, intensity!] as const)));
      }
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Check-In options.'))
      .finally(() => setLoading(false));
    closeButton.current?.focus();
  }, [checkInId, editing]);

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
    if (mood === null || saving || !bedtimeValid || !wakeTimeValid) return;
    setSaving(true); setError('');
    try {
      const sleep = buildSleepInput(sleepQuality, bedtime, wakeTime);
      await apiRequest<CheckInResponse>(editing ? `/api/check-ins/${checkInId}` : '/api/check-ins', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({
        mood, feelingIds, pain, symptoms: selectedSymptoms,
        factors: Object.entries(factorRatings).map(([factorId, intensity]) => ({ factorId: Number(factorId), intensity })),
        ...(!editing && sleepTouched && sleep ? { sleep } : {}),
      }) });
      setSaved(true);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      navigate(editing ? '/app/history' : '/app', { replace: true });
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
        {loading && <p role="status">Loading Check-In…</p>}
        {!loading && <>
        {step === 0 && <MoodStep mood={mood} setMood={setMood} feelings={feelings.filter((item) => item.isPinned)} feelingIds={feelingIds} setFeelingIds={setFeelingIds} customize={() => setCustomizing('feelings')} />}
        {step === 1 && <PainAndSymptomsStep pain={pain} setPain={setPain} symptoms={symptoms} ratings={symptomRatings} setRatings={setSymptomRatings} customize={setCustomizing} />}
        {!editing && step === 2 && <SleepForm existingSleep={existingSleep} quality={sleepQuality} bedtime={bedtime} wakeTime={wakeTime} bedtimeValid={bedtimeValid} wakeTimeValid={wakeTimeValid} onQuality={(value) => { setSleepTouched(true); setSleepQuality(value); }} onBedtime={(value) => { setSleepTouched(true); setBedtime(value); }} onWakeTime={(value) => { setSleepTouched(true); setWakeTime(value); }} onBedtimeValidity={setBedtimeValid} onWakeTimeValidity={setWakeTimeValid} />}
        {step === steps.length - 1 && <FactorStep factors={factors.filter((factor) => factor.isPinned)} ratings={factorRatings} setRatings={setFactorRatings} customize={() => setCustomizing('factors')} />}
        </>}
      </div>
      {error && <p className={styles.error!} role="alert">{error}</p>}
      {saved && <p className={styles.success!} role="status">Check-In saved. Returning home…</p>}
      <footer className={styles.footer!}>
        <button type="button" className={styles.secondary!} disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Back</button>
        {step < steps.length - 1
          ? <button type="button" className={styles.primary!} disabled={(step === 0 && mood === null) || (!editing && step === 2 && (!bedtimeValid || !wakeTimeValid)) || saving} onClick={() => setStep((current) => current + 1)}>Next</button>
          : <button type="button" className={styles.primary!} disabled={mood === null || saving || loading} onClick={save}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Check-In'}</button>}
      </footer>
    </section>
    {customizing === 'feelings' && <CustomizationDialog kind="feelings" items={feelings} onChange={setFeelings} onClose={() => setCustomizing(null)} />}
    {customizing === 'factors' && <CustomizationDialog kind="factors" items={factors} onChange={setFactors} onClose={() => setCustomizing(null)} />}
    {customizing && customizing !== 'feelings' && customizing !== 'factors' && <CustomizationDialog kind="symptoms" category={customizing} items={symptoms.filter((item) => item.category === customizing)} onChange={(items) => updateSymptoms(customizing, items)} onClose={() => setCustomizing(null)} />}
  </div>;
}

function mergeById<T extends { id: number }>(current: T[], historical: T[]): T[] {
  const existingIds = new Set(current.map(({ id }) => id));
  return [...current, ...historical.filter(({ id }) => !existingIds.has(id))];
}

export function SleepForm({ existingSleep, quality, bedtime, wakeTime, bedtimeValid, wakeTimeValid, onQuality, onBedtime, onWakeTime, onBedtimeValidity, onWakeTimeValidity }: {
  existingSleep: SleepEntry | null; quality: number | null; bedtime: string; wakeTime: string; bedtimeValid: boolean; wakeTimeValid: boolean;
  onQuality(value: number | null): void; onBedtime(value: string): void; onWakeTime(value: string): void;
  onBedtimeValidity(valid: boolean): void; onWakeTimeValidity(valid: boolean): void;
}) {
  const qualityLabels = ['Very Poor', 'Poor', 'Okay', 'Good', 'Great'];
  const durationMinutes = bedtime && wakeTime && bedtimeValid && wakeTimeValid ? deriveSleepDurationMinutes(bedtime, wakeTime) : null;
  return <div className={styles.sleepStep!}>
    <div><h2>How did you sleep?</h2><p className={styles.hint!}>{existingSleep ? 'Your Sleep for this tracking day is ready to update.' : 'Add only what you know. You can leave this step blank.'}</p></div>
    <fieldset className={styles.sleepGroup!}><legend>Sleep times</legend><div className={styles.timeInputs!}>
      <TwelveHourTimeInput label="Bedtime" value={bedtime} onChange={onBedtime} onValidityChange={onBedtimeValidity} />
      <TwelveHourTimeInput label="Wake Time" value={wakeTime} onChange={onWakeTime} onValidityChange={onWakeTimeValidity} />
    </div></fieldset>
    <fieldset className={styles.sleepGroup!}><legend>Sleep quality</legend><div className={styles.qualityOptions!}>{qualityLabels.map((label, index) => {
      const value = index + 1;
      return <button type="button" key={value} aria-pressed={quality === value} className={quality === value ? styles.selected : ''} onClick={() => onQuality(quality === value ? null : value)}><strong>{label}</strong><span>{value}/5</span></button>;
    })}</div></fieldset>
    <fieldset className={styles.sleepGroup!}><legend>Estimated sleep duration</legend>
      {durationMinutes === null ? <p className={styles.hint!}>Enter both Sleep times to calculate a duration.</p> : <output className={styles.derivedDuration!} aria-label="Estimated sleep duration">{formatDuration(durationMinutes)}</output>}
    </fieldset>
  </div>;
}

function TwelveHourTimeInput({ label, value, onChange, onValidityChange }: { label: string; value: string; onChange(value: string): void; onValidityChange(valid: boolean): void }) {
  const initial = from24HourTime(value);
  const [text, setText] = useState(initial.text);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  useEffect(() => { const next = from24HourTime(value); setText(next.text); setPeriod(next.period); }, [value]);
  function update(nextText: string, nextPeriod = period) {
    setText(nextText); setPeriod(nextPeriod);
    if (nextText.trim() === '') { onChange(''); onValidityChange(true); return; }
    const match = /^(1[0-2]|[1-9]):([0-5]\d)$/.exec(nextText.trim());
    onValidityChange(Boolean(match));
    if (match) onChange(to24HourTime(Number(match[1]), Number(match[2]), nextPeriod));
  }
  return <div className={styles.timeField!}><label htmlFor={`${label}-time`}>{label}</label><div><input id={`${label}-time`} aria-label={label} inputMode="numeric" placeholder="1:30" value={text} onChange={(event) => update(event.target.value)} /><select aria-label={`${label} AM or PM`} value={period} onChange={(event) => update(text, event.target.value as 'AM' | 'PM')}><option>AM</option><option>PM</option></select></div></div>;
}

function from24HourTime(value: string): { text: string; period: 'AM' | 'PM' } {
  if (!value) return { text: '', period: 'AM' };
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return { text: `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`, period: hour >= 12 ? 'PM' : 'AM' };
}

function formatDuration(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

function PainAndSymptomsStep({ pain, setPain, symptoms, ratings, setRatings, customize }: { pain: number | null; setPain(value: number | null): void; symptoms: Symptom[]; ratings: Ratings; setRatings(value: Ratings): void; customize(value: SymptomCategory): void }) {
  return <div className={styles.symptomStage!}>
    <DiscreteRow label="Generalized Pain" values={11} selected={pain} onSelect={setPain} labels={[]} compact />
    {(['Physical Pain', 'Physical Other', 'Mental', 'Cognitive'] as SymptomCategory[]).map((category) => <section className={styles.symptomCategory!} key={category}>
      <SectionTitle title={category} edit={() => customize(category)} />
      <SymptomRows items={symptoms.filter((item) => item.category === category && item.isPinned)} ratings={ratings} setRatings={setRatings} />
    </section>)}
  </div>;
}

function MoodStep({ mood, setMood, feelings, feelingIds, setFeelingIds, customize }: { mood: number | null; setMood(value: number): void; feelings: Feeling[]; feelingIds: number[]; setFeelingIds(value: number[]): void; customize(): void }) {
  return <><h2>How are you feeling?</h2><div className={styles.moodGrid!}>{moods.map(({ value, label, sprite }) => <button type="button" key={value} aria-label={`${label}, mood ${value} of 5`} aria-pressed={mood === value} className={mood === value ? styles.selected : ''} onClick={() => setMood(value)}><img className={styles.moodSprite!} src={sprite} alt="" aria-hidden="true" /><strong>{label}</strong></button>)}</div>
    {mood !== null && <><SectionTitle title="Add feelings" edit={customize} plus /><div className={styles.chips!}>{feelings.map((feeling) => <button type="button" key={feeling.id} aria-pressed={feelingIds.includes(feeling.id)} className={feelingIds.includes(feeling.id) ? styles.selected : ''} onClick={() => setFeelingIds(feelingIds.includes(feeling.id) ? feelingIds.filter((id) => id !== feeling.id) : [...feelingIds, feeling.id])}>{feeling.name}</button>)}</div></>}
  </>;
}

function SectionTitle({ title, edit, plus = false }: { title: string; edit(): void; plus?: boolean }) { return <div className={styles.sectionTitle!}><h2>{title}</h2><button type="button" aria-label={plus ? `Customize ${title.replace(/^Add /, '')}` : `Edit ${title}`} onClick={edit}>{plus ? '+' : 'Edit'}</button></div>; }

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
