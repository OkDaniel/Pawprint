// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Factor, Symptom, SymptomCategory } from '@capstone/shared';
import { CheckInPage } from './CheckInPage';

const feelings = [
  { id: 1, slug: 'calm', name: 'Calm', isBuiltin: true, isPinned: true },
  { id: 2, slug: null, name: 'Centered', isBuiltin: false, isPinned: true },
  { id: 3, slug: 'happy', name: 'Happy', isBuiltin: true, isPinned: false },
];
const symptoms: Record<SymptomCategory, Symptom[]> = {
  'Physical Pain': [
    { id: 10, slug: 'headache', name: 'Headache', category: 'Physical Pain', isBuiltin: true, isPinned: true },
    { id: 14, slug: 'joint-pain', name: 'Joint Pain', category: 'Physical Pain', isBuiltin: true, isPinned: false },
    { id: 15, slug: 'stomach-pain', name: 'Stomach Pain', category: 'Physical Pain', isBuiltin: true, isPinned: false },
  ],
  'Physical Other': [{ id: 11, slug: 'fatigue', name: 'Fatigue', category: 'Physical Other', isBuiltin: true, isPinned: true }],
  Mental: [
    { id: 12, slug: 'anxiety', name: 'Anxiety', category: 'Mental', isBuiltin: true, isPinned: true },
    { id: 16, slug: null, name: 'Sensory Overload', category: 'Mental', isBuiltin: false, isPinned: false },
  ],
  Cognitive: [
    { id: 13, slug: 'brain-fog', name: 'Brain Fog', category: 'Cognitive', isBuiltin: true, isPinned: true },
    { id: 17, slug: null, name: 'Difficulty concentrating during afternoon meetings', category: 'Cognitive', isBuiltin: false, isPinned: true },
  ],
} as const;
const factors: Factor[] = [
  { id: 20, slug: 'study', name: 'Study', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: true },
  { id: 21, slug: 'travel', name: 'Travel', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: false },
  { id: 22, slug: 'weather', name: 'Weather', category: 'Environment', intensity: null, isBuiltin: true, isPinned: false },
  { id: 23, slug: 'poor-sleep', name: 'Poor Sleep', category: 'Sleep', intensity: null, isBuiltin: true, isPinned: false },
  { id: 24, slug: 'stress', name: 'Stress', category: 'Mental / Behavioral', intensity: null, isBuiltin: true, isPinned: false },
  { id: 25, slug: 'exercise', name: 'Exercise', category: 'Physical', intensity: null, isBuiltin: true, isPinned: false },
  { id: 26, slug: 'caffeine', name: 'Caffeine', category: 'Food / Substances', intensity: null, isBuiltin: true, isPinned: false },
  { id: 27, slug: 'custom-commute', name: 'Commute', category: 'Lifestyle', intensity: null, isBuiltin: false, isPinned: false },
];

function mockApi(currentSleep: unknown = null) {
  let savedBody: unknown;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/feelings') return json({ feelings });
    if (url.startsWith('/api/symptoms?')) {
      const category = decodeURIComponent(url.split('=')[1] ?? '') as keyof typeof symptoms;
      return json({ symptoms: symptoms[category] });
    }
    if (url === '/api/factors') return json({ factors });
    if (url === '/api/sleep/current') return json({ sleep: currentSleep });
    if (url === '/api/check-ins' && init?.method === 'POST') {
      savedBody = JSON.parse(String(init.body));
      return json({ checkIn: {} }, 201);
    }
    if (url === '/api/check-ins/42' && !init?.method) return json({ checkIn: { id: 42, occurredAt: '2026-09-15T12:00:00Z', logicalDate: '2026-09-15', mood: 4, feelings: [feelings[0]], pain: 0, symptoms: [{ symptomId: 10, name: 'Headache', category: 'Physical Pain', severity: 0 }], factors: [{ ...factors[0], intensity: 2 }] } });
    if (url === '/api/check-ins/42' && init?.method === 'PUT') { savedBody = JSON.parse(String(init.body)); return json({ checkIn: {} }); }
    if (url === '/api/symptoms/preferences' && init?.method === 'PUT') {
      return json({ symptoms: symptoms['Physical Pain'] });
    }
    if (url === '/api/factors/preferences' && init?.method === 'PUT') return json({ factors });
    if (url === '/api/feelings/preferences' && init?.method === 'PUT') {
      const ids = new Set((JSON.parse(String(init.body)) as { ids: number[] }).ids);
      return json({ feelings: feelings.map((item) => ({ ...item, isPinned: ids.has(item.id) })) });
    }
    if (url === '/api/feelings/2' && init?.method === 'DELETE') return json({ feelings: feelings.filter(({ id }) => id !== 2) });
    throw new Error(`Unexpected request: ${url}`);
  });
  return { fetchMock, savedBody: () => savedBody };
}

function mockReliabilityApi(saveFailure?: { code: string; message: string; details: unknown }) {
  const reliabilityFeelings = [
    { id: 1, slug: 'confused', name: 'Confused', isBuiltin: true, isPinned: true },
    { id: 2, slug: 'anxious', name: 'Anxious', isBuiltin: true, isPinned: true },
  ];
  const symptomLibraries: Record<SymptomCategory, Symptom[]> = {
    'Physical Pain': [...symptoms['Physical Pain']],
    'Physical Other': [...symptoms['Physical Other']],
    Mental: [...symptoms.Mental],
    Cognitive: [...symptoms.Cognitive],
  };
  let factorLibrary: Factor[] = [...factors];
  let nextSymptomId = 30;
  let nextFactorId = 40;
  let savedBody: Record<string, unknown> | undefined;
  let pendingSaveFailure = saveFailure;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as { name?: string; ids?: number[]; category?: string } : {};
    if (url === '/api/feelings') return json({ feelings: reliabilityFeelings });
    if (url.startsWith('/api/symptoms?')) {
      const category = decodeURIComponent(url.split('=')[1] ?? '') as keyof typeof symptomLibraries;
      return json({ symptoms: symptomLibraries[category] });
    }
    if (url === '/api/symptoms' && init?.method === 'POST') {
      const name = body.name?.trim() ?? '';
      const category = body.category as SymptomCategory;
      const duplicate = Object.values(symptomLibraries).flat().find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (duplicate) return apiError('DUPLICATE_CUSTOM_ITEM', `${duplicate.name} already exists under ${duplicate.category}. Select it from the list above instead.`, 409);
      symptomLibraries[category] = [...symptomLibraries[category], { id: nextSymptomId++, slug: null, name, category, isBuiltin: false, isPinned: false }];
      return json({ symptoms: symptomLibraries[category] }, 201);
    }
    if (url.startsWith('/api/symptoms/') && init?.method === 'DELETE') {
      const id = Number(url.split('/')[3]?.split('?')[0]);
      symptomLibraries.Mental = symptomLibraries.Mental.filter((item) => item.id !== id);
      return json({ symptoms: symptomLibraries.Mental });
    }
    if (url === '/api/symptoms/preferences' && init?.method === 'PUT') {
      const category = body.category as keyof typeof symptomLibraries;
      const pinned = new Set(body.ids ?? []);
      symptomLibraries[category] = symptomLibraries[category].map((item) => ({ ...item, isPinned: pinned.has(item.id) })) as typeof symptomLibraries[typeof category];
      return json({ symptoms: symptomLibraries[category] });
    }
    if (url === '/api/factors' && !init?.method) return json({ factors: factorLibrary });
    if (url === '/api/factors' && init?.method === 'POST') {
      const name = body.name?.trim() ?? '';
      const duplicate = factorLibrary.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (duplicate) return apiError('DUPLICATE_CUSTOM_ITEM', `${duplicate.name} already exists under ${duplicate.category}. Select it from the list above instead.`, 409);
      factorLibrary = [...factorLibrary, { id: nextFactorId++, slug: `custom-${nextFactorId}`, name, category: body.category as Factor['category'], intensity: null, isBuiltin: false, isPinned: false }];
      return json({ factors: factorLibrary }, 201);
    }
    if (url.startsWith('/api/factors/') && init?.method === 'DELETE') {
      const id = Number(url.split('/').at(-1));
      factorLibrary = factorLibrary.filter((item) => item.id !== id);
      return json({ factors: factorLibrary });
    }
    if (url === '/api/factors/preferences' && init?.method === 'PUT') {
      const pinned = new Set(body.ids ?? []);
      factorLibrary = factorLibrary.map((item) => ({ ...item, isPinned: pinned.has(item.id) }));
      return json({ factors: factorLibrary });
    }
    if (url === '/api/sleep/current') return json({ sleep: null });
    if (url === '/api/check-ins' && init?.method === 'POST') {
      if (pendingSaveFailure) {
        const failure = pendingSaveFailure;
        pendingSaveFailure = undefined;
        return apiError(failure.code, failure.message, 400, failure.details);
      }
      savedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return json({ checkIn: {} }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  return {
    fetchMock,
    savedBody: () => savedBody,
    removeFactorBeforeSave(name: string) { factorLibrary = factorLibrary.filter((item) => item.name !== name); },
  };
}

function renderWizard() {
  render(<MemoryRouter initialEntries={['/app/check-in']}><Routes>
    <Route path="/app/check-in" element={<CheckInPage />} />
    <Route path="/app/history" element={<h1>History should not open</h1>} />
    <Route path="/app" element={<TestHome />} />
  </Routes></MemoryRouter>);
}

function renderEditor() {
  render(<MemoryRouter initialEntries={['/app/check-in/42/edit']}><Routes>
    <Route path="/app/check-in/:checkInId/edit" element={<CheckInPage />} />
    <Route path="/app/history" element={<h1>History reached</h1>} />
  </Routes></MemoryRouter>);
}

function renderWizardWithReopen() {
  render(<MemoryRouter initialEntries={['/app/check-in']}><Routes>
    <Route path="/app/check-in" element={<CheckInPage />} />
    <Route path="/app" element={<TestHome withReopen />} />
  </Routes></MemoryRouter>);
}

function TestHome({ withReopen = false }: { withReopen?: boolean }) {
  const location = useLocation();
  const state = location.state as { justCompletedCheckIn?: boolean } | null;
  return <>
    <h1>Home reached</h1>
    <output data-testid="check-in-completion-signal">{String(Boolean(state?.justCompletedCheckIn))}</output>
    {withReopen && <Link to="/app/check-in">Reopen Check In</Link>}
  </>;
}

function enterTime(label: 'Bedtime' | 'Wake Time', text: string, period: 'AM' | 'PM') {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: `${label} ${period}` }));
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Check-In wizard', () => {
  it('requires Mood before enabling progression and keeps feelings optional', async () => {
    mockApi(); renderWizard();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your Check-In');
    expect(screen.queryByText('Loading Check-In…')).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByText('Add Feelings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    expect(screen.getByText('Add Feelings')).toBeInTheDocument();
    const editList = screen.getByRole('button', { name: '+ Edit list' });
    expect(editList).toHaveTextContent(/^\+ Edit list$/);
    expect(editList).not.toHaveAttribute('aria-pressed');
    expect(editList.parentElement?.lastElementChild).toBe(editList);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Pain & Symptoms', level: 1 })).toBeInTheDocument();
  });

  it('navigates all steps, preserves Back state, and submits explicit zero values', async () => {
    const api = mockApi();
    renderWizard();
    expect(await screen.findByRole('heading', { name: 'Mood', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Pain & Symptoms', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generalized Pain: 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Headache: 0, None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatigue: 0, None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Sleep', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Fatigue: 0, None' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Factors', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Study: Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Check-In saved');
    expect(await screen.findByRole('heading', { name: 'Home reached' }, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.getByTestId('check-in-completion-signal')).toHaveTextContent('true');
    expect(screen.queryByRole('heading', { name: 'History should not open' })).not.toBeInTheDocument();
    expect(api.savedBody()).toMatchObject({ mood: 4, pain: 0, symptoms: expect.arrayContaining([{ symptomId: 10, severity: 0 }, { symptomId: 11, severity: 0 }]), factors: [{ factorId: 20, intensity: 2 }] });
  });

  it('swaps the one Check-In modal to the compact categorized Symptom editor', async () => {
    const api = mockReliabilityApi();
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const headacheRating = screen.getByRole('button', { name: 'Headache: 2, Moderate' });
    fireEvent.click(headacheRating);
    expect(screen.queryByRole('button', { name: 'Physical Pain' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customize symptoms' })).toHaveTextContent(/^Customize symptoms$/);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    const dialog = screen.getByRole('dialog', { name: 'Customize symptoms' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Customize symptoms', level: 1 })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to Pain & Symptoms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Check-In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    const choices = within(dialog).getByRole('region', { name: 'Symptom choices' });
    for (const category of ['Physical Pain', 'Physical Other', 'Mental', 'Cognitive']) expect(within(choices).getByRole('heading', { name: category, level: 3 })).toBeInTheDocument();
    expect(dialog.querySelector('[aria-expanded]')).toBeNull();
    expect(dialog.querySelector('label[class*="chip"]')).toBeNull();
    const creator = within(dialog).getByRole('region', { name: 'Add your own' });
    expect(choices.contains(creator)).toBe(false);
    const done = within(dialog).getByRole('button', { name: 'Done' });
    expect(choices.contains(done)).toBe(false);
    expect(done.closest('footer')).not.toBeNull();
    const categorySelect = within(dialog).getByRole('combobox', { name: 'Category' });
    expect(categorySelect).toHaveValue('Physical Pain');
    expect(within(categorySelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['Physical Pain', 'Physical Other', 'Mental', 'Cognitive']);
    expect(within(within(dialog).getByRole('region', { name: 'Physical Pain' })).getByRole('checkbox', { name: 'Headache' })).toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Physical Other' })).getByRole('checkbox', { name: 'Fatigue' })).toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Mental' })).getByRole('checkbox', { name: 'Anxiety' })).toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Cognitive' })).getByRole('checkbox', { name: 'Brain Fog' })).toBeChecked();
    const jointPain = within(within(dialog).getByRole('region', { name: 'Physical Pain' })).getByRole('checkbox', { name: 'Joint Pain' });
    expect(jointPain).not.toBeChecked();
    fireEvent.click(jointPain);
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/symptoms/preferences', expect.objectContaining({ method: 'PUT' })));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize symptoms' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Headache: 2, Moderate' })).toHaveAttribute('aria-pressed', 'true');
    const jointPainRating = await screen.findByRole('button', { name: 'Joint Pain: 2, Moderate' });
    fireEvent.click(jointPainRating);
    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Joint Pain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Joint Pain: 2, Moderate' })).not.toBeInTheDocument());
  });

  it('swaps the one Check-In modal to the compact six-category Factor editor without search', async () => {
    const api = mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const studyRating = screen.getByRole('button', { name: 'Study: Medium' });
    fireEvent.click(studyRating);
    const customize = screen.getByRole('button', { name: 'Customize factors' });
    expect(customize).toHaveTextContent(/^Customize factors$/);
    expect(screen.queryByRole('button', { name: 'Lifestyle' })).not.toBeInTheDocument();
    fireEvent.click(customize);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const dialog = screen.getByRole('dialog', { name: 'Customize factors' });
    expect(screen.getByRole('heading', { name: 'Customize factors', level: 1 })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to Factors' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Check-In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Check-In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    const choices = within(dialog).getByRole('region', { name: 'Factor choices' });
    for (const category of ['Lifestyle', 'Sleep', 'Mental / Behavioral', 'Physical', 'Food / Substances', 'Environment']) expect(within(choices).getByRole('heading', { name: category, level: 3 })).toBeInTheDocument();
    expect(dialog.querySelector('[aria-expanded]')).toBeNull();
    expect(dialog.querySelector('label[class*="chip"]')).toBeNull();
    const creator = within(dialog).getByRole('region', { name: 'Add your own' });
    expect(choices.contains(creator)).toBe(false);
    expect(choices.contains(within(dialog).getByRole('button', { name: 'Done' }))).toBe(false);
    const categorySelect = within(dialog).getByRole('combobox', { name: 'Category' });
    expect(within(categorySelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['Lifestyle', 'Sleep', 'Mental / Behavioral', 'Physical', 'Food / Substances', 'Environment']);
    const lifestyle = within(dialog).getByRole('region', { name: 'Lifestyle' });
    expect(within(lifestyle).getByRole('checkbox', { name: 'Study' })).toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Sleep' })).getByRole('checkbox', { name: 'Poor Sleep' })).not.toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Mental / Behavioral' })).getByRole('checkbox', { name: 'Stress' })).not.toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Physical' })).getByRole('checkbox', { name: 'Exercise' })).not.toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Food / Substances' })).getByRole('checkbox', { name: 'Caffeine' })).not.toBeChecked();
    expect(within(within(dialog).getByRole('region', { name: 'Environment' })).getByRole('checkbox', { name: 'Weather' })).not.toBeChecked();
    fireEvent.click(within(lifestyle).getByRole('checkbox', { name: 'Travel' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/factors/preferences', expect.objectContaining({ method: 'PUT' })));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize factors' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Study: Medium' })).toHaveAttribute('aria-pressed', 'true');
    const travelRating = await screen.findByRole('button', { name: 'Travel: Medium' });
    fireEvent.click(travelRating);
    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Travel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Travel: Medium' })).not.toBeInTheDocument());
  });

  it('swaps Feelings inside the one modal and preserves Mood and Feeling draft state through Done and Back', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    const mood = screen.getByRole('button', { name: 'Good, mood 4 of 5' });
    fireEvent.click(mood);
    const calm = screen.getByRole('button', { name: 'Calm' });
    fireEvent.click(calm);
    const customize = screen.getByRole('button', { name: '+ Edit list' });
    expect(customize).toHaveTextContent(/^\+ Edit list$/);
    expect(customize).not.toHaveAttribute('aria-pressed');
    fireEvent.click(customize);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Customize feelings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customize feelings', level: 1 })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to Mood' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Check-In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Centered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Edit list' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Good, mood 4 of 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Centered' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Edit list' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Centered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Mood' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Edit list' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Centered' })).toBeInTheDocument();
  });

  it('uses an in-app confirmation before archiving a custom feeling', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Edit list' }));
    const dialog = screen.getByRole('dialog', { name: 'Customize feelings' });
    const choices = within(dialog).getByRole('region', { name: 'Feeling choices' });
    const creator = within(dialog).getByRole('region', { name: 'Add your own' });
    expect(within(choices).getByRole('checkbox', { name: 'Calm' })).toBeChecked();
    expect(within(choices).getByRole('checkbox', { name: 'Centered' })).toBeChecked();
    expect(choices.contains(creator)).toBe(false);
    expect(choices.contains(within(dialog).getByRole('button', { name: 'Done' }))).toBe(false);
    expect(within(dialog).queryByRole('combobox', { name: 'Category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Calm' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Centered' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Centered?' })).toBeInTheDocument();
    expect(screen.getByText('This removes it from your tracked feelings. Past Check-Ins will remain available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Feeling' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep feeling' }));
    expect(screen.getByRole('button', { name: 'Delete Centered' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Centered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Feeling' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/feelings/2', expect.objectContaining({ method: 'DELETE' })));
  });

  it('blocks case-insensitive Feeling duplicates without clearing the typed text or calling create', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Edit list' }));
    const input = screen.getByRole('textbox', { name: 'Feeling name' });
    fireEvent.change(input, { target: { value: '  happy  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Happy already exists. Select it from the list above instead.');
    expect(input).toHaveValue('  happy  ');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(input).toHaveFocus());
    expect(api.fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/feelings' && init?.method === 'POST')).toBe(false);
  });

  it('blocks built-in and private Symptom duplicates across categories with canonical context', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Customize symptoms' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    const input = screen.getByRole('textbox', { name: 'Symptom name' });
    const category = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.change(category, { target: { value: 'Physical Other' } });
    fireEvent.change(input, { target: { value: 'stomach pain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stomach Pain already exists under Physical Pain. Select it from the list above instead.');
    expect(input).toHaveValue('stomach pain');
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(category, { target: { value: 'Cognitive' } });
    fireEvent.change(input, { target: { value: 'SENSORY OVERLOAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sensory Overload already exists under Mental. Select it from the list above instead.');
    expect(screen.getByRole('button', { name: 'Delete Sensory Overload' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Sensory Overload' }));
    expect(screen.getByText('This removes it from your tracked symptoms. Past Check-Ins will remain available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Symptom' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep symptom' }));
    expect(api.fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/symptoms' && init?.method === 'POST')).toBe(false);
  });

  it('blocks built-in and private Factor duplicates across categories and keeps Delete terminology', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Customize factors' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    const input = screen.getByRole('textbox', { name: 'Factor name' });
    const category = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.change(input, { target: { value: ' CAFFEINE ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Caffeine already exists under Food / Substances. Select it from the list above instead.');
    expect(input).toHaveValue(' CAFFEINE ');

    fireEvent.change(category, { target: { value: 'Environment' } });
    fireEvent.change(input, { target: { value: 'commute' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Commute already exists under Lifestyle. Select it from the list above instead.');
    expect(screen.getByRole('button', { name: 'Delete Commute' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Commute' }));
    expect(screen.getByText('This removes it from your tracked factors. Past Check-Ins will remain available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Factor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep factor' }));
    expect(api.fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/factors' && init?.method === 'POST')).toBe(false);
  });

  it('removes a deleted symptom rating, auto-adds valid Done text, and saves the exact recovery sequence', async () => {
    const api = mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anxious' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generalized Pain: 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Headache: 2, Moderate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anxiety: 2, Moderate' }));

    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Mental' } });
    fireEvent.change(screen.getByPlaceholderText('Symptom name'), { target: { value: 'Mania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/symptoms', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Mania', category: 'Mental' }) })));
    expect(screen.getByRole('checkbox', { name: 'Mania' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mania: 1, Mild' }));

    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Mania' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Mania?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Symptom' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Mania' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Customize symptoms', level: 1 })).toHaveFocus());

    fireEvent.change(screen.getByPlaceholderText('Symptom name'), { target: { value: 'Hypomania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Pain & Symptoms' }));
    const hypomania = await screen.findByRole('button', { name: 'Hypomania: 1, Mild' });
    expect(screen.queryByRole('button', { name: /Mania:/ })).not.toBeInTheDocument();
    fireEvent.click(hypomania);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', '1:30', 'PM');
    enterTime('Wake Time', '12:30', 'AM');
    fireEvent.click(screen.getByRole('button', { name: 'Okay' }));
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('11h 0m');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    fireEvent.change(screen.getByPlaceholderText('Factor name'), { target: { value: 'Restless' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/factors', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Restless', category: 'Lifestyle' }) })));
    const restless = await screen.findByRole('button', { name: 'Restless: A little' });
    fireEvent.click(restless);
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');

    expect(api.savedBody()).toMatchObject({
      mood: 3,
      feelingIds: [1, 2],
      pain: 5,
      sleep: { bedtime: '13:30', wakeTime: '00:30', durationMinutes: 660, qualityScore: 3 },
      symptoms: expect.arrayContaining([{ symptomId: 10, severity: 2 }, { symptomId: 12, severity: 2 }, { symptomId: 31, severity: 1 }]),
      factors: [{ factorId: 40, intensity: 1 }],
    });
    expect(api.savedBody()?.symptoms).not.toEqual(expect.arrayContaining([{ symptomId: 30, severity: 1 }]));
  });

  it('keeps invalid or duplicate custom text in the editor instead of closing or discarding it', async () => {
    mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize symptoms' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Mental' } });
    const input = screen.getByPlaceholderText('Symptom name');
    fireEvent.change(input, { target: { value: 'Anxiety' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Anxiety already exists under Mental. Select it from the list above instead.');
    expect(input).toHaveValue('Anxiety');
    expect(screen.getByRole('dialog', { name: 'Customize symptoms' })).toBeInTheDocument();
  });

  it('removes a deleted custom Factor intensity from the in-progress draft', async () => {
    const api = mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    fireEvent.change(screen.getByPlaceholderText('Factor name'), { target: { value: 'Restless' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('checkbox', { name: 'Restless' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restless: Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Restless' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Factor' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Restless' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ factors: [] });
  });

  it('strips an item that became unavailable before Save instead of locking the draft', async () => {
    const api = mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize factors' }));
    fireEvent.change(screen.getByPlaceholderText('Factor name'), { target: { value: 'Restless' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restless: A lot' }));
    api.removeFactorBeforeSave('Restless');
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await waitFor(() => expect(api.savedBody()).toBeDefined());
    expect(api.savedBody()).toMatchObject({ factors: [] });
  });

  it('closes library customization with Escape and returns focus without discarding Check-In', async () => {
    mockReliabilityApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const customize = screen.getByRole('button', { name: 'Customize symptoms' });
    fireEvent.click(customize);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customize symptoms' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alertdialog', { name: 'Discard this Check-In?' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize symptoms' })).toHaveFocus());
  });

  it('shows an item-specific stale error, removes the affected value, and allows a direct retry', async () => {
    const api = mockReliabilityApi({
      code: 'INVALID_SYMPTOMS',
      message: '“Headache” was removed from your tracked symptoms.',
      details: { kind: 'symptoms', unavailableIds: [10], items: [{ id: 10, name: 'Headache' }] },
    });
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Headache: 2, Moderate' }));
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('“Headache” was removed from your tracked symptoms. It has been removed from this draft. Save again.');
    expect(screen.queryByRole('heading', { name: 'Home reached' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await waitFor(() => expect(api.savedBody()).toBeDefined());
    expect(api.savedBody()).toMatchObject({ symptoms: [] });
  });

  it('uses an in-app discard dialog and reopens with a fresh draft', async () => {
    mockReliabilityApi(); renderWizardWithReopen();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generalized Pain: 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Headache: 2, Moderate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', '11:30', 'PM');
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Study: Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Check-In' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard this Check-In?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('button', { name: 'Study: Medium' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close Check-In' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard Check-In' }));
    expect(await screen.findByRole('heading', { name: 'Home reached' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Reopen Check In' }));
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    expect(screen.getByRole('button', { name: 'Good, mood 4 of 5' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    expect(screen.getByRole('button', { name: 'Confused' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Generalized Pain: 5' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Headache: 2, Moderate' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Study: Medium' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps untouched optional measurements absent when saving Mood alone', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Great, mood 5 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toEqual({ mood: 5, feelingIds: [], pain: null, symptoms: [], factors: [] });
  });

  it.each([
    ['Very Low', 1],
    ['Low', 2],
    ['Okay', 3],
    ['Good', 4],
    ['Great', 5],
  ] as const)('maps the %s cat option to Mood %i', async (label, value) => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    const option = screen.getByRole('button', { name: `${label}, mood ${value} of 5` });
    expect(option.querySelector('img')).toHaveAttribute('alt', '');
    expect(option.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(option);
    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Add Feelings')).toBeInTheDocument();
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ mood: value });
  });

  it('renders normal-text ratings while submitting Pain 10 and preserving symptom severity 4', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const painTen = screen.getByRole('button', { name: 'Generalized Pain: 10' });
    expect(painTen).toHaveTextContent('10');
    expect(painTen.querySelector('[data-pixel-number]')).toBeNull();
    expect(painTen.querySelector('[data-pixel-glyph]')).toBeNull();
    fireEvent.click(painTen);
    const symptomFour = screen.getByRole('button', { name: 'Headache: 4, Very Severe' });
    expect(symptomFour).toHaveTextContent('4');
    expect(symptomFour.querySelector('[data-pixel-glyph]')).toBeNull();
    fireEvent.click(symptomFour);
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ pain: 10, symptoms: [{ symptomId: 10, severity: 4 }] });
  });

  it('keeps a stable qualitative feedback slot and exposes long symptom labels without changing the rating controls', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const headacheRow = screen.getByRole('group', { name: 'Headache' });
    const feedbackSlot = headacheRow.querySelector('small');
    expect(feedbackSlot).not.toBeNull();
    expect(feedbackSlot).toHaveTextContent('');
    fireEvent.click(within(headacheRow).getByRole('button', { name: 'Headache: 3, Severe' }));
    expect(headacheRow.querySelector('small')).toBe(feedbackSlot);
    expect(feedbackSlot).toHaveTextContent('Severe');
    fireEvent.click(within(headacheRow).getByRole('button', { name: 'Headache: 3, Severe' }));
    expect(headacheRow.querySelector('small')).toBe(feedbackSlot);

    const longLabelRow = screen.getByRole('group', { name: 'Difficulty concentrating during afternoon meetings' });
    expect(within(longLabelRow).getAllByRole('button')).toHaveLength(5);
    expect(within(screen.getByRole('group', { name: 'Generalized Pain' })).getAllByRole('button')).toHaveLength(11);
  });

  it('converts 12-hour Sleep input and calculates overnight duration through Back', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Sleep', level: 1 })).toBeInTheDocument();
    const sleepAccent = document.querySelector('[data-sleep-accent]');
    expect(sleepAccent).toHaveAttribute('aria-hidden', 'true');
    expect(sleepAccent?.querySelector('img')).toHaveAttribute('src', expect.stringContaining('mochi-classic-sleep.png'));
    expect(sleepAccent?.querySelector('img')).toHaveAttribute('alt', '');
    enterTime('Bedtime', '11:30', 'PM');
    enterTime('Wake Time', '7:00', 'AM');
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    expect(screen.queryByText(/\/5/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('7h 30m');
    expect(screen.getByText('Calculated from bedtime and wake time.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /duration/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('11:30');
    expect(screen.getByRole('button', { name: 'Bedtime PM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('7h 30m');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ sleep: { bedtime: '23:30', wakeTime: '07:00', durationMinutes: 450, qualityScore: 4 } });
  });

  it('prefills existing daily Sleep but omits it when the user leaves it untouched', async () => {
    const api = mockApi({ id: 8, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: 450, qualityScore: 4 });
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('7h 30m');
    expect(screen.getByLabelText('Bedtime')).toHaveValue('11:30');
    expect(screen.getByRole('button', { name: 'Bedtime PM' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).not.toHaveProperty('sleep');
  });

  it('recalculates duration whenever a Sleep time changes', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', '12:50', 'AM');
    enterTime('Wake Time', '9:50', 'AM');
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('9h 0m');
    fireEvent.change(screen.getByLabelText('Wake Time'), { target: { value: '8:00' } });
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent('7h 10m');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ sleep: { bedtime: '00:50', wakeTime: '08:00', durationMinutes: 430 } });
    expect(api.savedBody()).not.toHaveProperty('sleepTouched');
  });

  it.each([
    ['12:50', 'AM', '9:50', 'AM', '9h 0m'],
    ['11:30', 'PM', '7:30', 'AM', '8h 0m'],
    ['10:45', 'PM', '6:15', 'AM', '7h 30m'],
    ['1:30', 'AM', '8:00', 'AM', '6h 30m'],
  ] as const)('calculates %s %s to %s %s as %s', async (bed, bedPeriod, wake, wakePeriod, expected) => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', bed, bedPeriod);
    enterTime('Wake Time', wake, wakePeriod);
    expect(screen.getByLabelText('Calculated sleep duration')).toHaveTextContent(expected);
  });

  it.each(['Bedtime', 'Wake Time'] as const)('does not calculate duration with only %s', async (field) => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime(field, '1:30', 'AM');
    expect(screen.queryByLabelText('Calculated sleep duration')).not.toBeInTheDocument();
    expect(screen.getByText('Enter bedtime and wake time to calculate duration.')).toBeInTheDocument();
  });

  it('keeps unset times genuinely empty and makes the mutually exclusive period selection clearable', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('');
    const am = screen.getByRole('button', { name: 'Bedtime AM' });
    const pm = screen.getByRole('button', { name: 'Bedtime PM' });
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Bedtime')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '1:30' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'true');
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(am);
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Bedtime')).toHaveValue('1:30');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(pm);
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pm);
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(am);
    fireEvent.click(pm);
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '' } });
    expect(am).toHaveAttribute('aria-pressed', 'false');
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it.each([
    ['130', '1:30', '13:30'],
    ['1230', '12:30', '12:30'],
    ['930', '9:30', '21:30'],
    ['1030', '10:30', '22:30'],
    ['705', '7:05', '19:05'],
    ['1130', '11:30', '23:30'],
  ] as const)('formats compact Sleep time %s live as %s and normalizes it with PM', async (compact, visible, normalized) => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const bedtime = screen.getByLabelText('Bedtime') as HTMLInputElement;
    for (const digit of compact) fireEvent.change(bedtime, { target: { value: `${bedtime.value}${digit}` } });
    expect(bedtime).toHaveValue(visible);
    fireEvent.click(screen.getByRole('button', { name: 'Bedtime PM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ sleep: { bedtime: normalized } });
  });

  it.each([
    ['0:30', '0:30'],
    ['13:00', '13:00'],
    ['1:60', '1:60'],
    ['1360', '13:60'],
    ['1260', '12:60'],
    ['0030', '00:30'],
  ] as const)('rejects completed invalid typed time %s', async (invalidTime, displayedTime) => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: invalidTime } });
    fireEvent.click(screen.getByRole('button', { name: 'Bedtime AM' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue(displayedTime);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it.each([
    ['12:00', 'AM', '00:00'],
    ['12:00', 'PM', '12:00'],
    ['1:05', 'PM', '13:05'],
  ] as const)('normalizes %s %s to %s and keeps quality optional', async (text, period, normalized) => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', text, period);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    await screen.findByRole('status');
    expect(api.savedBody()).toMatchObject({ sleep: { bedtime: normalized, wakeTime: null, durationMinutes: null, qualityScore: null } });
  });

  it.each([
    ['23:30', '11:30', 'PM'],
    ['07:05', '7:05', 'AM'],
    ['00:15', '12:15', 'AM'],
    ['12:20', '12:20', 'PM'],
  ] as const)('prefills persisted %s as %s %s', async (stored, text, period) => {
    mockApi({ id: 8, logicalDate: '2026-09-15', bedtime: stored, wakeTime: null, durationMinutes: null, qualityScore: null });
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue(text);
    expect(screen.getByRole('button', { name: `Bedtime ${period}` })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps persisted text visible but incomplete when its period is cleared', async () => {
    mockApi({ id: 8, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: null, durationMinutes: null, qualityScore: null });
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const pm = screen.getByRole('button', { name: 'Bedtime PM' });
    fireEvent.click(pm);
    expect(screen.getByLabelText('Bedtime')).toHaveValue('11:30');
    expect(pm).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('does not carry an unsaved Sleep draft into a newly opened Check-In', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    enterTime('Bedtime', '11:30', 'PM');
    cleanup();
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Bedtime AM' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Bedtime PM' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('prefills and updates an existing Check-In without presenting daily Sleep as its child', async () => {
    const api = mockApi(); renderEditor();
    const mood = await screen.findByRole('button', { name: 'Good, mood 4 of 5' });
    expect(mood).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Generalized Pain: 0' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Headache: 0, None' })).toHaveAttribute('aria-pressed', 'true');
    const customizeSymptoms = screen.getByRole('button', { name: 'Customize symptoms' });
    fireEvent.click(customizeSymptoms);
    expect(screen.getByRole('dialog', { name: 'Customize symptoms' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize symptoms' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Factors', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sleep', level: 1 })).not.toBeInTheDocument();
    const customizeFactors = screen.getByRole('button', { name: 'Customize factors' });
    fireEvent.click(customizeFactors);
    expect(screen.getByRole('dialog', { name: 'Customize factors' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize factors' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('heading', { name: 'History reached' }, { timeout: 1500 })).toBeInTheDocument();
    expect(api.savedBody()).toMatchObject({ mood: 4, pain: 0, symptoms: [{ symptomId: 10, severity: 0 }], factors: [{ factorId: 20, intensity: 2 }] });
    expect(api.savedBody()).not.toHaveProperty('sleep');
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function apiError(code: string, message: string, status: number, details?: unknown): Response {
  return json({ error: { code, message, details } }, status);
}
