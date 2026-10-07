import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deriveSleepDurationMinutes, symptomCategories, to24HourTime, type CheckInResponse, type Factor, type FactorListResponse, type Feeling, type FeelingListResponse, type SleepCurrentResponse, type SleepEntry, type Symptom, type SymptomCategory, type SymptomListResponse } from '@capstone/shared';
import { ApiError, apiRequest } from '../../api/api';
import { ConfirmDialog } from './ConfirmDialog';
import { FeelingCustomizationDialog } from './FeelingCustomizationDialog';
import { TrackingLibraryCustomizationDialog } from './TrackingLibraryCustomizationDialog';
import { FactorIntensityControl } from './FactorIntensityControl';
import styles from './CheckInPage.module.css';
import moodVeryLow from '../../assets/ui/mood-very-low.png';
import moodLow from '../../assets/ui/mood-low.png';
import moodOkay from '../../assets/ui/mood-okay.png';
import moodGood from '../../assets/ui/mood-good.png';
import moodGreat from '../../assets/ui/mood-great.png';
import mochiClassicSleep from '../../assets/cat/mochi-classic-sleep.png';
import { buildSleepInput } from './sleepDraft';
import { formatCompactSleepTime, parseTwelveHourTime } from './sleepTimeInput';

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
type LibraryDraft = { feelings: Feeling[]; symptoms: Symptom[]; factors: Factor[] };
type UnavailableDetails = { kind?: unknown; unavailableIds?: unknown };
type LibraryCustomization = 'feelings' | 'symptoms' | 'factors' | null;

export function CheckInPage() {
  const navigate = useNavigate();
  const { checkInId } = useParams();
  const editing = checkInId !== undefined;
  const steps = editing ? editSteps : createSteps;
  const closeButton = useRef<HTMLButtonElement>(null);
  const feelingCustomizeButton = useRef<HTMLButtonElement>(null);
  const symptomCustomizeButton = useRef<HTMLButtonElement>(null);
  const factorCustomizeButton = useRef<HTMLButtonElement>(null);
  const returnFocusTarget = useRef<Exclude<LibraryCustomization, null> | null>(null);
  const historicalLibraries = useRef<LibraryDraft>({ feelings: [], symptoms: [], factors: [] });
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
  const [customization, setCustomization] = useState<LibraryCustomization>(null);
  const [returningFromCustomization, setReturningFromCustomization] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saveRecovery, setSaveRecovery] = useState('');

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
        const historical: LibraryDraft = {
          feelings: existingCheckIn.checkIn.feelings,
          symptoms: existingCheckIn.checkIn.symptoms.map((item) => ({ id: item.symptomId, slug: null, name: item.name, category: item.category, isBuiltin: false, isPinned: true })),
          factors: existingCheckIn.checkIn.factors,
        };
        historicalLibraries.current = historical;
        setFeelings((current) => mergeById(current, historical.feelings));
        setSymptoms((current) => mergeById(current, historical.symptoms));
        setFactors((current) => mergeById(current, historical.factors));
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
  function requestClose() {
    if (dirty) setConfirmingDiscard(true);
    else navigate('/app');
  }
  function discard() {
    setStep(0);
    setMood(null);
    setFeelingIds([]);
    setPain(null);
    setSymptomRatings({});
    setFactorRatings({});
    setExistingSleep(null);
    setSleepTouched(false);
    setSleepQuality(null);
    setBedtime('');
    setWakeTime('');
    setBedtimeValid(true);
    setWakeTimeValid(true);
    setCustomization(null);
    setReturningFromCustomization(false);
    setError('');
    setSaveRecovery('');
    setConfirmingDiscard(false);
    navigate('/app', { replace: true });
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !customization && !confirmingDiscard) requestClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });
  useEffect(() => {
    if (customization || !returningFromCustomization || !returnFocusTarget.current) return;
    const target = returnFocusTarget.current === 'feelings' ? feelingCustomizeButton : returnFocusTarget.current === 'symptoms' ? symptomCustomizeButton : factorCustomizeButton;
    const frame = window.requestAnimationFrame(() => target.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [customization, returningFromCustomization]);

  async function save() {
    if (mood === null || saving || !bedtimeValid || !wakeTimeValid) return;
    setSaving(true); setError(''); setSaveRecovery('');
    try {
      const prepared = await prepareDraftForSave();
      const sleep = buildSleepInput(sleepQuality, bedtime, wakeTime);
      await apiRequest<CheckInResponse>(editing ? `/api/check-ins/${checkInId}` : '/api/check-ins', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({
        mood, feelingIds: prepared.feelingIds, pain, symptoms: prepared.symptoms,
        factors: prepared.factors,
        ...(!editing && sleepTouched && sleep ? { sleep } : {}),
      }) });
      if (prepared.removedNames.length > 0) setSaveRecovery(`${formatItemNames(prepared.removedNames)} no longer available and ${prepared.removedNames.length === 1 ? 'was' : 'were'} removed from this draft.`);
      setSaved(true);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      navigate(editing ? '/app/history' : '/app', {
        replace: true,
        state: editing ? null : { justCompletedCheckIn: true },
      });
    } catch (caught) {
      if (caught instanceof ApiError && removeUnavailableFromDraft(caught)) {
        setError(`${caught.message} It has been removed from this draft. Save again.`);
      } else setError(caught instanceof Error ? caught.message : 'Could not save this Check-In.');
      setSaving(false);
    }
  }

  async function prepareDraftForSave() {
    const active = await loadActiveLibraries();
    const visible = editing ? {
      feelings: mergeById(active.feelings, historicalLibraries.current.feelings),
      symptoms: mergeById(active.symptoms, historicalLibraries.current.symptoms),
      factors: mergeById(active.factors, historicalLibraries.current.factors),
    } : active;
    setFeelings(visible.feelings);
    setSymptoms(visible.symptoms);
    setFactors(visible.factors);
    const feelingIdSet = new Set([...active.feelings.filter(({ isPinned }) => isPinned).map(({ id }) => id), ...historicalLibraries.current.feelings.map(({ id }) => id)]);
    const symptomIdSet = new Set([...active.symptoms.filter(({ isPinned }) => isPinned).map(({ id }) => id), ...historicalLibraries.current.symptoms.map(({ id }) => id)]);
    const factorIdSet = new Set([...active.factors.filter(({ isPinned }) => isPinned).map(({ id }) => id), ...historicalLibraries.current.factors.map(({ id }) => id)]);
    const nextFeelingIds = feelingIds.filter((id) => feelingIdSet.has(id));
    const nextSymptomRatings = filterRatings(symptomRatings, symptomIdSet);
    const nextFactorRatings = filterRatings(factorRatings, factorIdSet);
    const removedIds = [
      ...feelingIds.filter((id) => !feelingIdSet.has(id)),
      ...ratingIds(symptomRatings).filter((id) => !symptomIdSet.has(id)),
      ...ratingIds(factorRatings).filter((id) => !factorIdSet.has(id)),
    ];
    const names = new Map([...feelings, ...symptoms, ...factors].map((item) => [item.id, item.name]));
    setFeelingIds(nextFeelingIds);
    setSymptomRatings(nextSymptomRatings);
    setFactorRatings(nextFactorRatings);
    return {
      feelingIds: nextFeelingIds,
      symptoms: Object.entries(nextSymptomRatings).map(([symptomId, severity]) => ({ symptomId: Number(symptomId), severity })),
      factors: Object.entries(nextFactorRatings).map(([factorId, intensity]) => ({ factorId: Number(factorId), intensity })),
      removedNames: removedIds.map((id) => names.get(id) ?? `Item ${id}`),
    };
  }

  function removeUnavailableFromDraft(caught: ApiError): boolean {
    if (!['INVALID_FEELINGS', 'INVALID_SYMPTOMS', 'INVALID_FACTORS'].includes(caught.code ?? '')) return false;
    const details = caught.details as UnavailableDetails | undefined;
    if (!Array.isArray(details?.unavailableIds) || !details.unavailableIds.every((id) => Number.isSafeInteger(id))) return false;
    const unavailableIds = new Set(details.unavailableIds as number[]);
    if (caught.code === 'INVALID_FEELINGS') setFeelingIds((current) => current.filter((id) => !unavailableIds.has(id)));
    if (caught.code === 'INVALID_SYMPTOMS') setSymptomRatings((current) => filterRatings(current, new Set(ratingIds(current).filter((id) => !unavailableIds.has(id)))));
    if (caught.code === 'INVALID_FACTORS') setFactorRatings((current) => filterRatings(current, new Set(ratingIds(current).filter((id) => !unavailableIds.has(id)))));
    return true;
  }

  function updateFeelings(updated: Feeling[]) {
    const available = new Set(updated.filter(({ isPinned }) => isPinned).map(({ id }) => id));
    setFeelingIds((current) => current.filter((id) => available.has(id)));
    setFeelings(updated);
  }

  function updateSymptoms(updated: Symptom[]) {
    const available = new Set(updated.filter(({ isPinned }) => isPinned).map(({ id }) => id));
    setSymptomRatings((current) => filterRatings(current, available));
    setSymptoms(updated);
  }

  function updateFactors(updated: Factor[]) {
    const available = new Set(updated.filter(({ isPinned }) => isPinned).map(({ id }) => id));
    setFactorRatings((current) => filterRatings(current, available));
    setFactors(updated);
  }

  function openCustomization(kind: Exclude<LibraryCustomization, null>) {
    setReturningFromCustomization(false);
    setCustomization(kind);
  }

  function closeCustomization(kind: Exclude<LibraryCustomization, null>) {
    returnFocusTarget.current = kind;
    setCustomization(null);
    setReturningFromCustomization(true);
  }

  function moveStep(direction: -1 | 1) {
    setReturningFromCustomization(false);
    setStep((current) => current + direction);
  }

  const customizationTitleId = customization ? `${customization}-customization-title` : 'check-in-title';
  return <div className={styles.backdrop!} onMouseDown={(event) => { if (event.target === event.currentTarget && !customization) requestClose(); }}>
    <section className={styles.dialog!} role="dialog" aria-modal="true" aria-labelledby={customizationTitleId} aria-hidden={confirmingDiscard || undefined}>
      {customization === 'feelings' && <FeelingCustomizationDialog stepTitle={steps[step]!} items={feelings} onChange={updateFeelings} onClose={() => closeCustomization('feelings')} />}
      {customization === 'symptoms' && <TrackingLibraryCustomizationDialog stepTitle={steps[step]!} kind="symptoms" items={symptoms} onChange={updateSymptoms} onClose={() => closeCustomization('symptoms')} />}
      {customization === 'factors' && <TrackingLibraryCustomizationDialog stepTitle={steps[step]!} kind="factors" items={factors} onChange={updateFactors} onClose={() => closeCustomization('factors')} />}
      {!customization && <div className={`${styles.mainView!} ${returningFromCustomization ? styles.viewReturn! : ''}`}>
        <header className={styles.header!}>
          <div><p className={styles.progressText!}>Step {step + 1} of {steps.length}</p><h1 id="check-in-title">{steps[step]}</h1></div>
          <button ref={closeButton} className={styles.close!} type="button" aria-label="Close Check-In" onClick={requestClose}>×</button>
        </header>
        <div className={styles.progressTrack!}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className={styles.content!}>
          {loading && <CheckInLoadingState />}
          {!loading && <>
          {step === 0 && <MoodStep customizeButtonRef={feelingCustomizeButton} mood={mood} setMood={setMood} feelings={feelings.filter((item) => item.isPinned)} feelingIds={feelingIds} setFeelingIds={setFeelingIds} customize={() => openCustomization('feelings')} />}
          {step === 1 && <PainAndSymptomsStep customizeButtonRef={symptomCustomizeButton} pain={pain} setPain={setPain} symptoms={symptoms} ratings={symptomRatings} setRatings={setSymptomRatings} customize={() => openCustomization('symptoms')} />}
          {!editing && step === 2 && <SleepForm existingSleep={existingSleep} quality={sleepQuality} bedtime={bedtime} wakeTime={wakeTime} bedtimeValid={bedtimeValid} wakeTimeValid={wakeTimeValid} onQuality={(value) => { setSleepTouched(true); setSleepQuality(value); }} onBedtime={(value) => { setSleepTouched(true); setBedtime(value); }} onWakeTime={(value) => { setSleepTouched(true); setWakeTime(value); }} onBedtimeValidity={setBedtimeValid} onWakeTimeValidity={setWakeTimeValid} />}
          {step === steps.length - 1 && <FactorStep customizeButtonRef={factorCustomizeButton} allFactors={factors} ratings={factorRatings} setRatings={setFactorRatings} customize={() => openCustomization('factors')} />}
          </>}
        </div>
        <div className={styles.statusArea!}>
          {error && <p className={styles.error!} role="alert">{error}</p>}
          {saveRecovery && <p className={styles.recovery!} role="status">{saveRecovery}</p>}
          {saved && <p className={styles.success!} role="status">Check-In saved. Returning home…</p>}
        </div>
        <footer className={styles.footer!}>
          <button type="button" className={styles.secondary!} disabled={step === 0 || saving} onClick={() => void moveStep(-1)}>Back</button>
          {step < steps.length - 1
            ? <button type="button" className={styles.primary!} disabled={(step === 0 && mood === null) || (!editing && step === 2 && (!bedtimeValid || !wakeTimeValid)) || saving} onClick={() => void moveStep(1)}>Next</button>
            : <button type="button" className={styles.primary!} disabled={mood === null || saving || loading} onClick={save}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Check-In'}</button>}
        </footer>
      </div>}
    </section>
    {confirmingDiscard && <ConfirmDialog
      title="Discard this Check-In?"
      body="Your unsaved changes will be cleared."
      cancelLabel="Keep editing"
      confirmLabel="Discard Check-In"
      onCancel={() => setConfirmingDiscard(false)}
      onConfirm={discard}
    />}
  </div>;
}

async function loadActiveLibraries(): Promise<LibraryDraft> {
  const [feelingResult, ...rest] = await Promise.all([
    apiRequest<FeelingListResponse>('/api/feelings'),
    ...(['Physical Pain', 'Physical Other', 'Mental', 'Cognitive'] as SymptomCategory[]).map((category) =>
      apiRequest<SymptomListResponse>(`/api/symptoms?category=${encodeURIComponent(category)}`)),
    apiRequest<FactorListResponse>('/api/factors'),
  ]);
  return {
    feelings: feelingResult.feelings,
    symptoms: rest.slice(0, 4).flatMap((result) => (result as SymptomListResponse).symptoms),
    factors: (rest[4] as FactorListResponse).factors,
  };
}

function ratingIds(ratings: Ratings): number[] { return Object.keys(ratings).map(Number); }
function filterRatings(ratings: Ratings, availableIds: Set<number>): Ratings {
  return Object.fromEntries(Object.entries(ratings).filter(([id]) => availableIds.has(Number(id))));
}
function formatItemNames(names: string[]): string {
  const quoted = names.map((name) => `“${name}”`);
  if (quoted.length <= 1) return quoted[0] ?? 'An item';
  return `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`;
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
    <div className={styles.sleepIntro!}><div><h2>How did you sleep?</h2><p className={styles.hint!}>{existingSleep ? 'Your Sleep for this tracking day is ready to update.' : 'Add only what you know. You can leave this step blank.'}</p></div><span className={styles.sleepAccent!} aria-hidden="true" data-sleep-accent><img src={mochiClassicSleep} alt="" /></span></div>
    <fieldset className={styles.sleepGroup!}><legend>Sleep times</legend><div className={styles.timeInputs!}>
      <TwelveHourTimeInput label="Bedtime" value={bedtime} onChange={onBedtime} onValidityChange={onBedtimeValidity} />
      <TwelveHourTimeInput label="Wake Time" value={wakeTime} onChange={onWakeTime} onValidityChange={onWakeTimeValidity} />
    </div></fieldset>
    <fieldset className={styles.sleepGroup!}><legend>Sleep quality</legend><div className={styles.qualityOptions!}>{qualityLabels.map((label, index) => {
      const value = index + 1;
      return <button type="button" key={value} aria-pressed={quality === value} className={quality === value ? styles.selected : ''} onClick={() => onQuality(quality === value ? null : value)}>{label}</button>;
    })}</div></fieldset>
    <fieldset className={`${styles.sleepGroup!} ${styles.durationGroup!}`}><legend>Sleep duration</legend>
      {durationMinutes === null
        ? <p className={styles.hint!}>Enter bedtime and wake time to calculate duration.</p>
        : <div className={styles.durationSummary!}><output className={styles.derivedDuration!} aria-label="Calculated sleep duration">{formatDuration(durationMinutes)}</output><p>Calculated from bedtime and wake time.</p></div>}
    </fieldset>
  </div>;
}

function CheckInLoadingState() {
  return <div className={styles.loadingState!} role="status" aria-live="polite">
    <div className={styles.loadingMark!} aria-hidden="true"><span /><span /><span /></div>
    <div><strong>Preparing your Check-In…</strong><p>Gathering your quick lists.</p></div>
  </div>;
}

type TimePeriod = '' | 'AM' | 'PM';

function TwelveHourTimeInput({ label, value, onChange, onValidityChange }: { label: string; value: string; onChange(value: string): void; onValidityChange(valid: boolean): void }) {
  const initial = from24HourTime(value);
  const [text, setText] = useState(initial.text);
  const [period, setPeriod] = useState<TimePeriod>(initial.period);
  const locallyEmittedValue = useRef<string | null>(null);

  useEffect(() => {
    if (locallyEmittedValue.current === value) {
      locallyEmittedValue.current = null;
      return;
    }
    const next = from24HourTime(value);
    setText(next.text);
    setPeriod(next.period);
  }, [value]);

  function emitValue(nextValue: string) {
    if (nextValue !== value) locallyEmittedValue.current = nextValue;
    onChange(nextValue);
  }

  function applyText(nextText: string) {
    setText(nextText);
    if (nextText.trim() === '') {
      setPeriod('');
      emitValue('');
      onValidityChange(true);
      return;
    }
    const parsed = parseTwelveHourTime(nextText);
    const valid = Boolean(parsed && period);
    onValidityChange(valid);
    if (parsed && period) emitValue(to24HourTime(parsed.hour, parsed.minute, period));
  }

  function updateText(nextText: string, inputType?: string) {
    applyText(formatCompactSleepTime(nextText, inputType));
  }

  function updatePeriod(nextPeriod: Exclude<TimePeriod, ''>) {
    const formatted = formatCompactSleepTime(text);
    const selectedPeriod = period === nextPeriod ? '' : nextPeriod;
    if (formatted !== text) setText(formatted);
    setPeriod(selectedPeriod);
    const parsed = parseTwelveHourTime(formatted);
    const valid = formatted.trim() === '' ? selectedPeriod === '' : Boolean(parsed && selectedPeriod);
    onValidityChange(valid);
    if (parsed && selectedPeriod) emitValue(to24HourTime(parsed.hour, parsed.minute, selectedPeriod));
    else emitValue('');
  }

  return <fieldset className={styles.timeField!}>
    <legend>{label}</legend>
    <div className={styles.timeEntry!}>
      <input aria-label={label} inputMode="numeric" placeholder="1:30" value={text} onChange={(event) => updateText(event.target.value, (event.nativeEvent as InputEvent).inputType)} />
      <div className={styles.periodOptions!} role="group" aria-label={`${label} AM or PM`}>
        {(['AM', 'PM'] as const).map((option) => <button key={option} type="button" aria-label={`${label} ${option}`} aria-pressed={period === option} onClick={() => updatePeriod(option)}>{option}</button>)}
      </div>
    </div>
  </fieldset>;
}

function from24HourTime(value: string): { text: string; period: TimePeriod } {
  if (!value) return { text: '', period: '' };
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return { text: `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`, period: hour >= 12 ? 'PM' : 'AM' };
}

function formatDuration(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

function PainAndSymptomsStep({ customizeButtonRef, pain, setPain, symptoms, ratings, setRatings, customize }: { customizeButtonRef: RefObject<HTMLButtonElement | null>; pain: number | null; setPain(value: number | null): void; symptoms: Symptom[]; ratings: Ratings; setRatings(value: Ratings): void; customize(): void }) {
  return <div className={styles.symptomStage!}>
    <DiscreteRow label="Generalized Pain" values={11} selected={pain} onSelect={setPain} labels={[]} compact />
    <div className={styles.libraryHeading!}><h2>Symptoms</h2><button ref={customizeButtonRef} className={styles.customizeAction!} type="button" onClick={customize}>Customize symptoms</button></div>
    <p className={`${styles.hint!} ${styles.libraryHint!}`}>Rate what you noticed today.</p>
    {symptomCategories.map((category) => <section className={styles.symptomCategory!} key={category}>
      <h2>{category}</h2>
      <SymptomRows items={symptoms.filter((item) => item.category === category && item.isPinned)} ratings={ratings} setRatings={setRatings} />
    </section>)}
  </div>;
}

function MoodStep({ customizeButtonRef, mood, setMood, feelings, feelingIds, setFeelingIds, customize }: { customizeButtonRef: RefObject<HTMLButtonElement | null>; mood: number | null; setMood(value: number): void; feelings: Feeling[]; feelingIds: number[]; setFeelingIds(value: number[]): void; customize(): void }) {
  return <><h2>How are you feeling?</h2><div className={styles.moodGrid!}>{moods.map(({ value, label, sprite }) => <button type="button" key={value} aria-label={`${label}, mood ${value} of 5`} aria-pressed={mood === value} className={mood === value ? styles.selected : ''} onClick={() => setMood(value)}><img className={styles.moodSprite!} src={sprite} alt="" aria-hidden="true" /><strong>{label}</strong></button>)}</div>
    {mood !== null && <><div className={styles.libraryHeading!}><h2>Add Feelings</h2></div><div className={styles.chips!}>{feelings.map((feeling) => <button type="button" key={feeling.id} aria-pressed={feelingIds.includes(feeling.id)} className={feelingIds.includes(feeling.id) ? styles.selected : ''} onClick={() => setFeelingIds(feelingIds.includes(feeling.id) ? feelingIds.filter((id) => id !== feeling.id) : [...feelingIds, feeling.id])}>{feeling.name}</button>)}<button ref={customizeButtonRef} className={styles.feelingsUtility!} type="button" onClick={customize}>+ Edit list</button></div></>}
  </>;
}

function SymptomRows({ items, ratings, setRatings }: { items: Symptom[]; ratings: Ratings; setRatings(value: Ratings): void }) {
  if (items.length === 0) return <p className={styles.hint!}>No tracked symptoms in this category.</p>;
  return <div className={styles.rows!}>{items.map((item) => <DiscreteRow key={item.id} label={item.name} values={5} selected={ratings[item.id] ?? null} labels={severityLabels} onSelect={(value) => { const next = { ...ratings }; if (value === null) delete next[item.id]; else next[item.id] = value; setRatings(next); }} />)}</div>;
}

function DiscreteRow({ label, values, selected, onSelect, labels, compact = false }: { label: string; values: number; selected: number | null; onSelect(value: number | null): void; labels: string[]; compact?: boolean }) {
  const hasFeedback = labels.length > 0;
  return <div className={`${styles.ratingRow!} ${compact ? styles.compactRatingRow! : ''}`} role="group" aria-label={label}><div className={`${styles.ratingLabel!} ${hasFeedback ? styles.ratingLabelWithFeedback! : ''}`}><strong>{label}</strong>{hasFeedback && <small aria-hidden="true">{selected !== null && labels[selected] ? labels[selected] : '\u00a0'}</small>}</div><div className={styles.ratingButtons!}>{Array.from({ length: values }, (_, value) => <button type="button" key={value} aria-label={`${label}: ${value}${labels[value] ? `, ${labels[value]}` : ''}`} aria-pressed={selected === value} className={selected === value ? styles.selected : ''} onClick={() => onSelect(selected === value ? null : value)}>{value}</button>)}</div></div>;
}

function FactorStep({ customizeButtonRef, allFactors, ratings, setRatings, customize }: { customizeButtonRef: RefObject<HTMLButtonElement | null>; allFactors: Factor[]; ratings: Ratings; setRatings(value: Ratings): void; customize(): void }) {
  const factors = allFactors.filter(({ isPinned }) => isPinned);
  return <><div className={styles.libraryHeading!}><h2>What's been going on?</h2><button ref={customizeButtonRef} className={styles.customizeAction!} type="button" onClick={customize}>Customize factors</button></div><p className={`${styles.hint!} ${styles.libraryHint!}`}>Choose how much each factor was present. Select a level, or tap it again to clear.</p><div className={styles.factorRows!}>{factors.map((factor) => <div className={styles.factorRow!} key={factor.id}><strong>{factor.name}</strong><FactorIntensityControl factorName={factor.name} selected={ratings[factor.id] ?? null} onChange={(value) => { const next = { ...ratings }; if (value === null) delete next[factor.id]; else next[factor.id] = value; setRatings(next); }} /></div>)}</div>{factors.length === 0 && <p className={styles.hint!}>Your quick list is empty. Customize factors to add some.</p>}</>;
}
