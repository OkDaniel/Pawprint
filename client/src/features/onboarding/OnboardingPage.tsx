import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEFAULT_CAT_APPEARANCE,
  factorCategories,
  symptomCategories,
  trackingLibraryStarterSlugs,
  type CatAppearanceKey,
  type Factor,
  type FactorCategory,
  type FactorListResponse,
  type Feeling,
  type FeelingListResponse,
  type Symptom,
  type SymptomCategory,
  type SymptomListResponse,
} from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { TrackingCategoryAccordion, TrackingCategoryList, TrackingChoiceChip, TrackingChoiceGrid } from '../../components/TrackingLibraryControls';
import pawprintMark from '../../assets/brand/pawprint-mark.png';
import room5 from '../../assets/room/room5.png';
import { CatAppearancePicker } from '../auth/CatAppearancePicker';
import { CatSprite } from '../home/CatSprite';
import styles from './OnboardingPage.module.css';

const TOTAL_STEPS = 6;

interface Libraries {
  feelings: Feeling[];
  symptoms: Symptom[];
  factors: Factor[];
}

interface StarterSelections {
  feelings: Set<number>;
  symptoms: Set<number>;
  factors: Set<number>;
}

interface OnboardingPageProps {
  mode?: 'live' | 'preview';
}

export function OnboardingPage({ mode = 'live' }: OnboardingPageProps) {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isPreview = mode === 'preview';
  const [step, setStep] = useState(1);
  const [libraries, setLibraries] = useState<Libraries | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [appearance, setAppearance] = useState<CatAppearanceKey>(isPreview ? DEFAULT_CAT_APPEARANCE : user?.catAppearance ?? DEFAULT_CAT_APPEARANCE);
  const [catName, setCatName] = useState(isPreview ? 'Mochi' : user?.catName ?? 'Mochi');
  const [nameError, setNameError] = useState('');
  const [feelingIds, setFeelingIds] = useState<Set<number>>(new Set());
  const [symptomIds, setSymptomIds] = useState<Set<number>>(new Set());
  const [factorIds, setFactorIds] = useState<Set<number>>(new Set());
  const [browseFeelings, setBrowseFeelings] = useState(false);
  const [browseSymptoms, setBrowseSymptoms] = useState(false);
  const [browseFactors, setBrowseFactors] = useState(false);
  const [openSymptomCategories, setOpenSymptomCategories] = useState<Set<SymptomCategory>>(new Set());
  const [openFactorCategories, setOpenFactorCategories] = useState<Set<FactorCategory>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadError('');
    Promise.all([
      apiRequest<FeelingListResponse>('/api/feelings'),
      ...symptomCategories.map((category) => apiRequest<SymptomListResponse>(`/api/symptoms?category=${encodeURIComponent(category)}`)),
      apiRequest<FactorListResponse>('/api/factors'),
    ]).then(([feelingResponse, ...remaining]) => {
      if (!active) return;
      const factorResponse = remaining.at(-1) as FactorListResponse;
      const symptomResponses = remaining.slice(0, -1) as SymptomListResponse[];
      const nextLibraries: Libraries = {
        feelings: feelingResponse.feelings.filter(({ isBuiltin }) => isBuiltin),
        symptoms: symptomResponses.flatMap(({ symptoms }) => symptoms.filter(({ isBuiltin }) => isBuiltin)),
        factors: factorResponse.factors.filter(({ isBuiltin }) => isBuiltin),
      };
      const starters = getStarterSelections(nextLibraries);
      setLibraries(nextLibraries);
      setFeelingIds(new Set(starters.feelings));
      setSymptomIds(new Set(starters.symptoms));
      setFactorIds(new Set(starters.factors));
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Could not load your quick-list choices.');
    });
    return () => { active = false; };
  }, [loadAttempt]);

  useLayoutEffect(() => {
    if (!libraries) return;
    if (contentRef.current) contentRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step, libraries]);

  if (loadError) {
    return <main className={styles.page!}><section className={styles.loadCard!} role="alert">
      <h1>We couldn’t prepare onboarding</h1><p>{loadError}</p>
      <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
    </section></main>;
  }
  if (!libraries) return <main className={styles.page!}><p className={styles.loading!} role="status">Preparing your Pawprint…</p></main>;
  const loadedLibraries = libraries;
  const starters = getStarterSelections(loadedLibraries);

  function resetPersonalizationPresentation() {
    setBrowseFeelings(false);
    setBrowseSymptoms(false);
    setBrowseFactors(false);
    setOpenSymptomCategories(new Set());
    setOpenFactorCategories(new Set());
  }

  function continueForward() {
    if (step === 2) {
      const trimmed = catName.trim();
      if (!trimmed) { setNameError('Give your companion a name.'); return; }
      if (trimmed.length > 40) { setNameError('Use 40 characters or fewer.'); return; }
      setCatName(trimmed);
      setNameError('');
    }
    resetPersonalizationPresentation();
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  }

  async function finish() {
    if (submitting) return;
    if (isPreview) { navigate('/app'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const trimmedName = catName.trim();
      navigate('/onboarding', { replace: true, state: { completingOnboarding: true } });
      await completeOnboarding({
        catAppearance: appearance,
        catName: trimmedName,
        feelingIds: [...feelingIds],
        symptomPreferences: symptomCategories.map((category) => ({
          category,
          ids: loadedLibraries.symptoms.filter((item) => item.category === category && symptomIds.has(item.id)).map(({ id }) => id),
        })),
        factorIds: [...factorIds],
      });
      navigate('/app', { replace: true, state: { justCompletedOnboarding: true, catName: trimmedName } });
    } catch (error) {
      navigate('/onboarding', { replace: true, state: null });
      setSubmitError(error instanceof Error ? error.message : 'Could not finish onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={styles.page!}>
    <section className={styles.card!} aria-label="Pawprint onboarding">
      <header className={styles.progressHeader!}>
        <span className={styles.brand!}>Pawprint {isPreview && <span className={styles.previewBadge!}>Onboarding preview</span>}</span>
        <span>Step {step} of {TOTAL_STEPS}</span>
        <progress aria-label={`Onboarding progress: step ${step} of ${TOTAL_STEPS}`} value={step} max={TOTAL_STEPS} />
      </header>

      <div ref={contentRef} className={styles.content!} data-testid="onboarding-content">
        {step === 1 && <WelcomeStep headingRef={headingRef} />}
        {step === 2 && <CompanionStep headingRef={headingRef} appearance={appearance} setAppearance={setAppearance} catName={catName} setCatName={(value) => { setCatName(value); setNameError(''); }} nameError={nameError} />}
        {step === 3 && <FeelingsStep headingRef={headingRef} feelings={loadedLibraries.feelings} starterIds={starters.feelings} selected={feelingIds} setSelected={setFeelingIds} browse={browseFeelings} setBrowse={setBrowseFeelings} />}
        {step === 4 && <SymptomsStep headingRef={headingRef} symptoms={loadedLibraries.symptoms} starterIds={starters.symptoms} selected={symptomIds} setSelected={setSymptomIds} browse={browseSymptoms} setBrowse={setBrowseSymptoms} openCategories={openSymptomCategories} setOpenCategories={setOpenSymptomCategories} />}
        {step === 5 && <FactorsStep headingRef={headingRef} factors={loadedLibraries.factors} starterIds={starters.factors} selected={factorIds} setSelected={setFactorIds} browse={browseFactors} setBrowse={setBrowseFactors} openCategories={openFactorCategories} setOpenCategories={setOpenFactorCategories} />}
        {step === 6 && <ReadyStep headingRef={headingRef} appearance={appearance} catName={catName} />}
      </div>

      {submitError && <p className={styles.error!} role="alert">{submitError}</p>}
      <footer className={styles.actions!}>
        {step > 1 ? <button className={styles.backButton!} type="button" disabled={submitting} onClick={() => { setSubmitError(''); resetPersonalizationPresentation(); setStep((current) => current - 1); }}>Back</button> : <span />}
        {step < TOTAL_STEPS
          ? <button className={styles.primaryButton!} type="button" onClick={continueForward}>Continue</button>
          : <button className={styles.primaryButton!} type="button" disabled={submitting} onClick={() => void finish()}>{isPreview ? 'Exit Preview' : submitting ? 'Preparing your room…' : 'Enter the Cat Room'}</button>}
      </footer>
    </section>
  </main>;
}

function WelcomeStep({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  return <div className={styles.welcome!}>
    <img className={styles.pawprintMark!} src={pawprintMark} alt="Pawprint paw mark" />
    <h1 ref={headingRef} tabIndex={-1}>Welcome to Pawprint</h1>
    <p>A cozy place to track how you’re doing.</p>
  </div>;
}

function CompanionStep({ headingRef, appearance, setAppearance, catName, setCatName, nameError }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  appearance: CatAppearanceKey;
  setAppearance(value: CatAppearanceKey): void;
  catName: string;
  setCatName(value: string): void;
  nameError: string;
}) {
  return <div className={styles.companion!}>
    <h1 ref={headingRef} tabIndex={-1}>Meet your companion</h1>
    <p>Choose a cat and give them a name.</p>
    <CatAppearancePicker legend="Cat appearance" value={appearance} onChange={setAppearance} />
    <label className={styles.nameField!}>Cat name
      <input value={catName} onChange={(event) => setCatName(event.target.value)} maxLength={40} required aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'cat-name-error' : undefined} />
    </label>
    {nameError && <p id="cat-name-error" className={styles.error!} role="alert">{nameError}</p>}
  </div>;
}

function FeelingsStep({ headingRef, feelings, starterIds, selected, setSelected, browse, setBrowse }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  feelings: Feeling[];
  starterIds: Set<number>;
  selected: Set<number>;
  setSelected(value: Set<number>): void;
  browse: boolean;
  setBrowse(value: boolean): void;
}) {
  const starterItems = orderedBySlugs(feelings, trackingLibraryStarterSlugs.feelings);
  const additionalItems = alphabetical(feelings.filter(({ id }) => !starterIds.has(id)));
  return <div>
    <h1 ref={headingRef} tabIndex={-1}>Choose your go-to feelings</h1>
    <p>These appear first when you add context to your Mood.</p>
    <StarterSet id="feeling-starters" items={starterItems} selected={selected} setSelected={setSelected} />
    <BrowseDisclosure label="Add more feelings" expanded={browse} controls="all-feelings" onToggle={() => setBrowse(!browse)} />
    {browse && <div id="all-feelings" className={styles.browsePanel!}>
      <TrackingChoiceGrid>{additionalItems.map((item) => <TrackingChoiceChip key={item.id} name={item.name} selected={selected.has(item.id)} onToggle={() => setSelected(toggled(selected, item.id))} />)}</TrackingChoiceGrid>
    </div>}
  </div>;
}

function SymptomsStep({ headingRef, symptoms, starterIds, selected, setSelected, browse, setBrowse, openCategories, setOpenCategories }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  symptoms: Symptom[];
  starterIds: Set<number>;
  selected: Set<number>;
  setSelected(value: Set<number>): void;
  browse: boolean;
  setBrowse(value: boolean): void;
  openCategories: Set<SymptomCategory>;
  setOpenCategories(value: Set<SymptomCategory>): void;
}) {
  const starterItems = symptomCategories.flatMap((category) => orderedBySlugs(symptoms.filter((item) => item.category === category), trackingLibraryStarterSlugs.symptoms[category]));
  return <div>
    <h1 ref={headingRef} tabIndex={-1}>Choose your go-to symptoms</h1>
    <p>We’ll put these first when you add symptoms to a Check-In.</p>
    <StarterSet id="symptom-starters" items={starterItems} selected={selected} setSelected={setSelected} />
    <BrowseDisclosure label="Add more symptoms" expanded={browse} controls="all-symptoms" onToggle={() => setBrowse(!browse)} />
    {browse && <div id="all-symptoms" className={styles.browsePanel!}>
      <TrackingCategoryList>{symptomCategories.map((category) => {
        const items = alphabetical(symptoms.filter((item) => item.category === category && !starterIds.has(item.id)));
        const expanded = openCategories.has(category);
        const panelId = `symptom-category-${toId(category)}`;
        return <TrackingCategoryAccordion key={category} id={panelId} label={category} expanded={expanded} onToggle={() => setOpenCategories(toggledValue(openCategories, category))}>
          <TrackingChoiceGrid>{items.map((item) => <TrackingChoiceChip key={item.id} name={item.name} selected={selected.has(item.id)} onToggle={() => setSelected(toggled(selected, item.id))} />)}</TrackingChoiceGrid>
        </TrackingCategoryAccordion>;
      })}</TrackingCategoryList>
    </div>}
  </div>;
}

function FactorsStep({ headingRef, factors, starterIds, selected, setSelected, browse, setBrowse, openCategories, setOpenCategories }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  factors: Factor[];
  starterIds: Set<number>;
  selected: Set<number>;
  setSelected(value: Set<number>): void;
  browse: boolean;
  setBrowse(value: boolean): void;
  openCategories: Set<FactorCategory>;
  setOpenCategories(value: Set<FactorCategory>): void;
}) {
  const starterItems = orderedBySlugs(factors, trackingLibraryStarterSlugs.factors);
  const additionalItems = factors.filter(({ id }) => !starterIds.has(id));
  return <div>
    <h1 ref={headingRef} tabIndex={-1}>Choose your everyday factors</h1>
    <p>These add context to your Check-Ins.</p>
    <StarterSet id="factor-starters" items={starterItems} selected={selected} setSelected={setSelected} />
    <BrowseDisclosure label="Add more factors" expanded={browse} controls="all-factors" onToggle={() => setBrowse(!browse)} />
    {browse && <div id="all-factors" className={styles.browsePanel!}>
      <TrackingCategoryList>{factorCategories.map((category) => {
        const items = alphabetical(additionalItems.filter((item) => item.category === category));
        const expanded = openCategories.has(category);
        const panelId = `factor-category-${toId(category)}`;
        return <TrackingCategoryAccordion key={category} id={panelId} label={category} expanded={expanded} onToggle={() => setOpenCategories(toggledValue(openCategories, category))}>
          <TrackingChoiceGrid>{items.map((item) => <TrackingChoiceChip key={item.id} name={item.name} selected={selected.has(item.id)} onToggle={() => setSelected(toggled(selected, item.id))} />)}</TrackingChoiceGrid>
        </TrackingCategoryAccordion>;
      })}</TrackingCategoryList>
    </div>}
  </div>;
}

function StarterSet<T extends { id: number; name: string }>({ id, items, selected, setSelected }: {
  id: string;
  items: T[];
  selected: Set<number>;
  setSelected(value: Set<number>): void;
}) {
  return <section className={styles.starterSection!} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Your starter set</h2>
    <TrackingChoiceGrid>{items.map((item) => <TrackingChoiceChip key={item.id} name={item.name} selected={selected.has(item.id)} onToggle={() => setSelected(toggled(selected, item.id))} />)}</TrackingChoiceGrid>
  </section>;
}

function BrowseDisclosure({ label, expanded, controls, onToggle }: { label: string; expanded: boolean; controls: string; onToggle(): void }) {
  return <button className={styles.disclosure!} type="button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}><span>{label}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span></button>;
}

function ReadyStep({ headingRef, appearance, catName }: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  appearance: CatAppearanceKey;
  catName: string;
}) {
  return <div className={styles.ready!}>
    <div className={styles.roomPreview!} aria-hidden="true"><img src={room5} alt="" /><div><CatSprite appearance={appearance} animation="excited" /></div></div>
    <h1 ref={headingRef} tabIndex={-1}>Your Pawprint is ready</h1>
    <p>{catName} is waiting for you.</p>
  </div>;
}

function getStarterSelections(libraries: Libraries): StarterSelections {
  const symptoms = new Set<number>();
  for (const category of symptomCategories) {
    for (const id of idsForSlugs(libraries.symptoms.filter((item) => item.category === category), trackingLibraryStarterSlugs.symptoms[category])) symptoms.add(id);
  }
  return {
    feelings: idsForSlugs(libraries.feelings, trackingLibraryStarterSlugs.feelings),
    symptoms,
    factors: idsForSlugs(libraries.factors, trackingLibraryStarterSlugs.factors),
  };
}

function idsForSlugs<T extends { id: number; slug: string | null }>(items: T[], slugs: readonly string[]): Set<number> {
  return new Set(orderedBySlugs(items, slugs).map(({ id }) => id));
}

function orderedBySlugs<T extends { slug: string | null }>(items: T[], slugs: readonly string[]): T[] {
  const bySlug = new Map(items.filter(({ slug }) => slug !== null).map((item) => [item.slug, item]));
  return slugs.flatMap((slug) => {
    const item = bySlug.get(slug);
    return item ? [item] : [];
  });
}

function alphabetical<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function toggled(current: Set<number>, id: number): Set<number> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

function toggledValue<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function toId(value: string): string {
  return value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '');
}
