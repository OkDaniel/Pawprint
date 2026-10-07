// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingCompletionInput } from '@capstone/shared';
import type { AuthContextValue } from '../../auth/authContextValue';
import { AuthContext } from '../../auth/authContextValue';
import { OnboardingPage } from './OnboardingPage';

const user = { id: 9, username: 'new-user', catAppearance: 'mochi-classic' as const, catName: 'Mochi', onboardingCompleted: false };
const feelings = [
  { id: 1, slug: 'happy', name: 'Happy', isBuiltin: true, isPinned: false },
  { id: 2, slug: 'grateful', name: 'Grateful', isBuiltin: true, isPinned: false },
  { id: 3, slug: 'calm', name: 'Calm', isBuiltin: true, isPinned: false },
  { id: 4, slug: 'okay', name: 'Okay', isBuiltin: true, isPinned: false },
  { id: 5, slug: 'tired', name: 'Tired', isBuiltin: true, isPinned: false },
  { id: 6, slug: 'confused', name: 'Confused', isBuiltin: true, isPinned: false },
  { id: 7, slug: 'anxious', name: 'Anxious', isBuiltin: true, isPinned: false },
  { id: 8, slug: 'stressed', name: 'Stressed', isBuiltin: true, isPinned: false },
  { id: 9, slug: 'overwhelmed', name: 'Overwhelmed', isBuiltin: true, isPinned: false },
  { id: 10, slug: 'confident', name: 'Confident', isBuiltin: true, isPinned: true },
  { id: 90, slug: null, name: 'Private feeling', isBuiltin: false, isPinned: true },
];
const symptoms = {
  'Physical Pain': [
    { id: 20, slug: 'headache', name: 'Headache', category: 'Physical Pain', isBuiltin: true, isPinned: false },
    { id: 21, slug: 'joint-pain', name: 'Joint Pain', category: 'Physical Pain', isBuiltin: true, isPinned: false },
    { id: 22, slug: 'back-pain', name: 'Back Pain', category: 'Physical Pain', isBuiltin: true, isPinned: false },
    { id: 23, slug: 'muscle-pain', name: 'Muscle Pain', category: 'Physical Pain', isBuiltin: true, isPinned: true },
  ],
  'Physical Other': [
    { id: 30, slug: 'fatigue', name: 'Fatigue', category: 'Physical Other', isBuiltin: true, isPinned: false },
    { id: 31, slug: 'dizziness', name: 'Dizziness', category: 'Physical Other', isBuiltin: true, isPinned: false },
    { id: 32, slug: 'drowsiness', name: 'Drowsiness', category: 'Physical Other', isBuiltin: true, isPinned: false },
    { id: 33, slug: 'nausea', name: 'Nausea', category: 'Physical Other', isBuiltin: true, isPinned: true },
  ],
  Mental: [
    { id: 40, slug: 'anxiety', name: 'Anxiety', category: 'Mental', isBuiltin: true, isPinned: false },
    { id: 41, slug: 'irritability', name: 'Irritability', category: 'Mental', isBuiltin: true, isPinned: false },
    { id: 42, slug: 'feeling-overwhelmed', name: 'Feeling Overwhelmed', category: 'Mental', isBuiltin: true, isPinned: false },
    { id: 43, slug: 'sense-of-dread', name: 'Sense of Dread', category: 'Mental', isBuiltin: true, isPinned: true },
  ],
  Cognitive: [
    { id: 50, slug: 'brain-fog', name: 'Brain Fog', category: 'Cognitive', isBuiltin: true, isPinned: false },
    { id: 51, slug: 'forgetfulness', name: 'Forgetfulness', category: 'Cognitive', isBuiltin: true, isPinned: false },
    { id: 52, slug: 'difficulty-focusing', name: 'Difficulty Focusing', category: 'Cognitive', isBuiltin: true, isPinned: false },
    { id: 53, slug: 'racing-thoughts', name: 'Racing Thoughts', category: 'Cognitive', isBuiltin: true, isPinned: true },
  ],
} as const;
const factors = [
  { id: 60, slug: 'study', name: 'Study', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: false },
  { id: 61, slug: 'work', name: 'Work', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: false },
  { id: 62, slug: 'exercise', name: 'Exercise', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: false },
  { id: 63, slug: 'social-activity', name: 'Social Activity', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: false },
  { id: 64, slug: 'stress', name: 'Stress', category: 'Mental / Behavioral', intensity: null, isBuiltin: true, isPinned: false },
  { id: 65, slug: 'poor-sleep', name: 'Poor Sleep', category: 'Sleep', intensity: null, isBuiltin: true, isPinned: false },
  { id: 66, slug: 'caffeine', name: 'Caffeine', category: 'Food / Substances', intensity: null, isBuiltin: true, isPinned: false },
  { id: 67, slug: 'procrastination', name: 'Procrastination', category: 'Mental / Behavioral', intensity: null, isBuiltin: true, isPinned: false },
  { id: 68, slug: 'weather', name: 'Weather', category: 'Environment', intensity: null, isBuiltin: true, isPinned: true },
  { id: 69, slug: 'noise', name: 'Noise', category: 'Environment', intensity: null, isBuiltin: true, isPinned: false },
  { id: 91, slug: 'custom', name: 'Private factor', category: 'Lifestyle', intensity: null, isBuiltin: false, isPinned: true },
];

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const headers = { 'Content-Type': 'application/json' };
    if (url === '/api/feelings') return new Response(JSON.stringify({ feelings }), { status: 200, headers });
    if (url === '/api/factors') return new Response(JSON.stringify({ factors }), { status: 200, headers });
    if (url.startsWith('/api/symptoms?category=')) {
      const category = decodeURIComponent(url.split('=')[1] ?? '') as keyof typeof symptoms;
      return new Response(JSON.stringify({ symptoms: symptoms[category] ?? [] }), { status: 200, headers });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPage(overrides: Partial<AuthContextValue> = {}, mode: 'live' | 'preview' = 'live') {
  const completeOnboarding = vi.fn(async (input: OnboardingCompletionInput) => { void input; });
  const value: AuthContextValue = {
    user, loading: false, login: vi.fn(), register: vi.fn(), updateCompanion: vi.fn(), completeOnboarding, logout: vi.fn(), ...overrides,
  };
  const path = mode === 'preview' ? '/onboarding-preview' : '/onboarding';
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={value}><Routes>
    <Route path={path} element={<OnboardingPage mode={mode} />} />
    <Route path="/app" element={<h1>Cat Room destination</h1>} />
  </Routes></AuthContext.Provider></MemoryRouter>);
  return { completeOnboarding };
}

function continueOnboarding() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

function starterSet() {
  return screen.getByRole('region', { name: 'Your starter set' });
}

describe('OnboardingPage', () => {
  it('uses the required six-step flow, progressively edits every starter set, and submits one snapshot', async () => {
    const { completeOnboarding } = renderPage();
    const intro = await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    expect(intro).toHaveFocus();
    expect(screen.getByAltText('Pawprint paw mark')).toBeInTheDocument();
    expect(screen.getByText('A cozy place to track how you’re doing.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /cat/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding preview')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '6');

    const content = screen.getByTestId('onboarding-content');
    content.scrollTop = 240;
    continueOnboarding();
    expect(screen.getByRole('heading', { name: 'Meet your companion' })).toHaveFocus();
    expect(content.scrollTop).toBe(0);
    expect(screen.getByText('Choose a cat and give them a name.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: /Grey/ }));
    fireEvent.change(screen.getByLabelText('Cat name'), { target: { value: 'ルナ' } });
    continueOnboarding();

    expect(screen.getByRole('heading', { name: 'Choose your go-to feelings' })).toHaveFocus();
    expect(screen.getByText('These appear first when you add context to your Mood.')).toBeInTheDocument();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Happy' })).toBeChecked();
    expect(screen.queryByText('Confident')).not.toBeInTheDocument();
    const feelingsBrowse = screen.getByRole('button', { name: 'Add more feelings' });
    expect(feelingsBrowse).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(starterSet()).getByRole('checkbox', { name: 'Happy' }));
    fireEvent.click(feelingsBrowse);
    expect(feelingsBrowse).toHaveAttribute('aria-expanded', 'true');
    const feelingsPanel = document.getElementById('all-feelings')!;
    expect(within(feelingsPanel).queryByRole('checkbox', { name: 'Happy' })).not.toBeInTheDocument();
    expect(within(feelingsPanel).getByRole('checkbox', { name: 'Confident' })).not.toBeChecked();
    expect(within(feelingsPanel).queryByText('Private feeling')).not.toBeInTheDocument();
    fireEvent.click(within(feelingsPanel).getByRole('checkbox', { name: 'Confident' }));
    fireEvent.click(feelingsBrowse);
    expect(document.getElementById('all-feelings')).not.toBeInTheDocument();

    content.scrollTop = 320;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Meet your companion' })).toHaveFocus();
    expect(content.scrollTop).toBe(0);
    expect(screen.getByLabelText('Cat name')).toHaveValue('ルナ');
    expect(screen.getByRole('radio', { name: /Grey/ })).toBeChecked();
    continueOnboarding();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Happy' })).not.toBeChecked();
    continueOnboarding();

    expect(screen.getByRole('heading', { name: 'Choose your go-to symptoms' })).toHaveFocus();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Headache' })).toBeChecked();
    const symptomsBrowse = screen.getByRole('button', { name: 'Add more symptoms' });
    expect(symptomsBrowse).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Physical Pain' })).not.toBeInTheDocument();
    fireEvent.click(symptomsBrowse);
    for (const category of ['Physical Pain', 'Physical Other', 'Mental', 'Cognitive']) {
      expect(screen.getByRole('button', { name: category })).toHaveAttribute('aria-expanded', 'false');
    }
    const physicalPain = screen.getByRole('button', { name: 'Physical Pain' });
    fireEvent.click(physicalPain);
    expect(physicalPain).toHaveAttribute('aria-expanded', 'true');
    const physicalPainPanel = document.getElementById('symptom-category-physical-pain')!;
    expect(within(physicalPainPanel).queryByRole('checkbox', { name: 'Headache' })).not.toBeInTheDocument();
    expect(within(physicalPainPanel).queryByRole('checkbox', { name: 'Joint Pain' })).not.toBeInTheDocument();
    expect(within(physicalPainPanel).queryByRole('checkbox', { name: 'Back Pain' })).not.toBeInTheDocument();
    expect(within(physicalPainPanel).getByRole('checkbox', { name: 'Muscle Pain' })).not.toBeChecked();
    fireEvent.click(within(physicalPainPanel).getByRole('checkbox', { name: 'Muscle Pain' }));
    fireEvent.click(physicalPain);
    expect(physicalPain).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('symptom-category-physical-pain')).not.toBeInTheDocument();
    fireEvent.click(symptomsBrowse);
    expect(screen.queryByRole('button', { name: 'Physical Pain' })).not.toBeInTheDocument();
    continueOnboarding();

    expect(screen.getByRole('heading', { name: 'Choose your everyday factors' })).toHaveFocus();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Study' })).toBeChecked();
    const factorsBrowse = screen.getByRole('button', { name: 'Add more factors' });
    expect(factorsBrowse).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(factorsBrowse);
    for (const category of ['Lifestyle', 'Sleep', 'Mental / Behavioral', 'Physical', 'Food / Substances', 'Environment']) {
      expect(screen.getByRole('button', { name: category })).toHaveAttribute('aria-expanded', 'false');
    }
    const lifestyle = screen.getByRole('button', { name: 'Lifestyle' });
    fireEvent.click(lifestyle);
    expect(within(document.getElementById('factor-category-lifestyle')!).queryByRole('checkbox', { name: 'Study' })).not.toBeInTheDocument();
    expect(within(document.getElementById('factor-category-lifestyle')!).queryByRole('checkbox', { name: 'Work' })).not.toBeInTheDocument();
    fireEvent.click(lifestyle);
    const environment = screen.getByRole('button', { name: 'Environment' });
    fireEvent.click(environment);
    expect(environment).toHaveAttribute('aria-expanded', 'true');
    const environmentPanel = document.getElementById('factor-category-environment')!;
    expect(within(environmentPanel).getByRole('checkbox', { name: 'Weather' })).not.toBeChecked();
    expect(within(environmentPanel).queryByText('Private factor')).not.toBeInTheDocument();
    fireEvent.click(within(environmentPanel).getByRole('checkbox', { name: 'Weather' }));
    fireEvent.click(environment);
    expect(environment).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(factorsBrowse);
    expect(screen.queryByRole('button', { name: 'Environment' })).not.toBeInTheDocument();
    continueOnboarding();

    expect(screen.getByRole('heading', { name: 'Your Pawprint is ready' })).toHaveFocus();
    expect(screen.getByText('ルナ is waiting for you.')).toBeInTheDocument();
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enter the Cat Room' }));
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledOnce());
    expect(completeOnboarding).toHaveBeenCalledWith({
      catAppearance: 'mochi-grey',
      catName: 'ルナ',
      feelingIds: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      symptomPreferences: [
        { category: 'Physical Pain', ids: [20, 21, 22, 23] },
        { category: 'Physical Other', ids: [30, 31, 32] },
        { category: 'Mental', ids: [40, 41, 42] },
        { category: 'Cognitive', ids: [50, 51, 52] },
      ],
      factorIds: [60, 61, 62, 63, 64, 65, 66, 67, 68],
    });
    expect(await screen.findByRole('heading', { name: 'Cat Room destination' })).toBeInTheDocument();
  });

  it('resets the content and focuses every Continue and Back destination without allowing focus to scroll it', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    renderPage();
    const headings = [
      'Welcome to Pawprint',
      'Meet your companion',
      'Choose your go-to feelings',
      'Choose your go-to symptoms',
      'Choose your everyday factors',
      'Your Pawprint is ready',
    ];
    const content = await screen.findByTestId('onboarding-content');
    expect(screen.getByRole('heading', { name: headings[0]! })).toHaveFocus();

    for (const heading of headings.slice(1)) {
      content.scrollTop = 480;
      continueOnboarding();
      expect(screen.getByRole('heading', { name: heading })).toHaveFocus();
      expect(content.scrollTop).toBe(0);
      expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    }

    for (const heading of [...headings].reverse().slice(1)) {
      content.scrollTop = 480;
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByRole('heading', { name: heading })).toHaveFocus();
      expect(content.scrollTop).toBe(0);
      expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    }
  });

  it.each(['live', 'preview'] as const)('preserves draft selections but resets personalization presentation in %s mode', async (mode) => {
    renderPage({}, mode);
    await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    const content = screen.getByTestId('onboarding-content');

    continueOnboarding();
    fireEvent.click(screen.getByRole('radio', { name: /Grey/ }));
    fireEvent.change(screen.getByLabelText('Cat name'), { target: { value: 'ルナ' } });
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more feelings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confident' }));
    content.scrollTop = 240;
    continueOnboarding();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(content.scrollTop).toBe(0);
    const feelingsBrowse = screen.getByRole('button', { name: 'Add more feelings' });
    expect(feelingsBrowse).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('all-feelings')).not.toBeInTheDocument();
    fireEvent.click(feelingsBrowse);
    expect(screen.getByRole('checkbox', { name: 'Confident' })).toBeChecked();
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more symptoms' }));
    fireEvent.click(screen.getByRole('button', { name: 'Physical Pain' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Muscle Pain' }));
    content.scrollTop = 240;
    continueOnboarding();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(content.scrollTop).toBe(0);
    const symptomsBrowse = screen.getByRole('button', { name: 'Add more symptoms' });
    expect(symptomsBrowse).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Physical Pain' })).not.toBeInTheDocument();
    fireEvent.click(symptomsBrowse);
    const physicalPain = screen.getByRole('button', { name: 'Physical Pain' });
    expect(physicalPain).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(physicalPain);
    expect(screen.getByRole('checkbox', { name: 'Muscle Pain' })).toBeChecked();
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more factors' }));
    fireEvent.click(screen.getByRole('button', { name: 'Environment' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Weather' }));
    content.scrollTop = 240;
    continueOnboarding();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(content.scrollTop).toBe(0);
    const factorsBrowse = screen.getByRole('button', { name: 'Add more factors' });
    expect(factorsBrowse).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Environment' })).not.toBeInTheDocument();
    fireEvent.click(factorsBrowse);
    const environment = screen.getByRole('button', { name: 'Environment' });
    expect(environment).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(environment);
    expect(screen.getByRole('checkbox', { name: 'Weather' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Cat name')).toHaveValue('ルナ');
    expect(screen.getByRole('radio', { name: /Grey/ })).toBeChecked();
  });

  it('keeps every canonical starter out of the Add more libraries', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    continueOnboarding();
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more feelings' }));
    const feelingsPanel = document.getElementById('all-feelings')!;
    for (const name of ['Happy', 'Grateful', 'Calm', 'Okay', 'Tired', 'Confused', 'Anxious', 'Stressed', 'Overwhelmed']) {
      expect(within(feelingsPanel).queryByRole('checkbox', { name })).not.toBeInTheDocument();
    }
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more symptoms' }));
    for (const category of ['Physical Pain', 'Physical Other', 'Mental', 'Cognitive']) fireEvent.click(screen.getByRole('button', { name: category }));
    const symptomsPanel = document.getElementById('all-symptoms')!;
    for (const name of ['Headache', 'Joint Pain', 'Back Pain', 'Fatigue', 'Dizziness', 'Drowsiness', 'Anxiety', 'Irritability', 'Feeling Overwhelmed', 'Brain Fog', 'Forgetfulness', 'Difficulty Focusing']) {
      expect(within(symptomsPanel).queryByRole('checkbox', { name })).not.toBeInTheDocument();
    }
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Add more factors' }));
    for (const category of ['Lifestyle', 'Sleep', 'Mental / Behavioral', 'Physical', 'Food / Substances', 'Environment']) fireEvent.click(screen.getByRole('button', { name: category }));
    const factorsPanel = document.getElementById('all-factors')!;
    for (const name of ['Study', 'Work', 'Exercise', 'Social Activity', 'Stress', 'Poor Sleep', 'Caffeine', 'Procrastination']) {
      expect(within(factorsPanel).queryByRole('checkbox', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps companion validation and all four supported appearances', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    continueOnboarding();
    const name = screen.getByLabelText('Cat name');
    fireEvent.change(name, { target: { value: '   ' } });
    continueOnboarding();
    expect(screen.getByRole('alert')).toHaveTextContent('Give your companion a name.');
    for (const label of ['Classic', 'Grey', 'Orange', 'White']) {
      fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeChecked();
    }
  });

  it('allows all three explicit preference snapshots to be empty', async () => {
    const { completeOnboarding } = renderPage();
    await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    continueOnboarding();
    continueOnboarding();
    for (const checkbox of within(starterSet()).getAllByRole('checkbox')) fireEvent.click(checkbox);
    continueOnboarding();
    for (const checkbox of within(starterSet()).getAllByRole('checkbox')) fireEvent.click(checkbox);
    continueOnboarding();
    for (const checkbox of within(starterSet()).getAllByRole('checkbox')) fireEvent.click(checkbox);
    continueOnboarding();
    fireEvent.click(screen.getByRole('button', { name: 'Enter the Cat Room' }));

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({ feelingIds: [], factorIds: [] })));
    const submitted = completeOnboarding.mock.calls[0]?.[0];
    expect(submitted?.symptomPreferences.every(({ ids }) => ids.length === 0)).toBe(true);
  });

  it('uses fresh canonical defaults in preview and never persists preview changes', async () => {
    const previewUser = { ...user, catAppearance: 'mochi-grey' as const, catName: 'Mochii', onboardingCompleted: true };
    const { completeOnboarding } = renderPage({ user: previewUser }, 'preview');
    await screen.findByRole('heading', { name: 'Welcome to Pawprint' });
    expect(screen.getByText('Onboarding preview')).toBeInTheDocument();

    continueOnboarding();
    expect(screen.getByRole('radio', { name: /Classic/ })).toBeChecked();
    expect(screen.getByLabelText('Cat name')).toHaveValue('Mochi');
    continueOnboarding();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Happy' })).toBeChecked();
    expect(screen.queryByText('Confident')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add more feelings' }));
    expect(screen.getByRole('checkbox', { name: 'Confident' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confident' }));
    continueOnboarding();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Headache' })).toBeChecked();
    continueOnboarding();
    expect(within(starterSet()).getByRole('checkbox', { name: 'Study' })).toBeChecked();
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Exit Preview' }));
    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Cat Room destination' })).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/onboarding/complete', expect.anything());
  });
});
