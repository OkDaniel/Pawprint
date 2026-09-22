// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckInPage } from './CheckInPage';

const feelings = [{ id: 1, slug: 'calm', name: 'Calm', isBuiltin: true, isPinned: true }, { id: 2, slug: null, name: 'Centered', isBuiltin: false, isPinned: true }];
const symptoms = {
  'Physical Pain': [{ id: 10, slug: 'headache', name: 'Headache', category: 'Physical Pain', isBuiltin: true, isPinned: true }],
  'Physical Other': [{ id: 11, slug: 'fatigue', name: 'Fatigue', category: 'Physical Other', isBuiltin: true, isPinned: true }],
  Mental: [{ id: 12, slug: 'anxiety', name: 'Anxiety', category: 'Mental', isBuiltin: true, isPinned: true }],
  Cognitive: [{ id: 13, slug: 'brain-fog', name: 'Brain Fog', category: 'Cognitive', isBuiltin: true, isPinned: true }],
} as const;
const factors = [{ id: 20, slug: 'study', name: 'Study', category: 'Lifestyle', intensity: null, isBuiltin: true, isPinned: true }];

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
    if (url === '/api/feelings/2' && init?.method === 'DELETE') return json({ feelings: [feelings[0]] });
    throw new Error(`Unexpected request: ${url}`);
  });
  return { fetchMock, savedBody: () => savedBody };
}

function renderWizard() {
  render(<MemoryRouter initialEntries={['/app/check-in']}><Routes>
    <Route path="/app/check-in" element={<CheckInPage />} />
    <Route path="/app/history" element={<h1>History should not open</h1>} />
    <Route path="/app" element={<h1>Home reached</h1>} />
  </Routes></MemoryRouter>);
}

function renderEditor() {
  render(<MemoryRouter initialEntries={['/app/check-in/42/edit']}><Routes>
    <Route path="/app/check-in/:checkInId/edit" element={<CheckInPage />} />
    <Route path="/app/history" element={<h1>History reached</h1>} />
  </Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Check-In wizard', () => {
  it('requires Mood before enabling progression and keeps feelings optional', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByText('Add feelings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    expect(screen.getByText('Add feelings')).toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'History should not open' })).not.toBeInTheDocument();
    expect(api.savedBody()).toMatchObject({ mood: 4, pain: 0, symptoms: expect.arrayContaining([{ symptomId: 10, severity: 0 }, { symptomId: 11, severity: 0 }]), factors: [{ factorId: 20, intensity: 2 }] });
  });

  it('persists an edited symptom quick list through the preferences API', async () => {
    const api = mockApi();
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Physical Pain' }));
    expect(screen.getByRole('heading', { name: 'Customize Physical Pain' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/symptoms/preferences', expect.objectContaining({ method: 'PUT' })));
  });

  it('opens factor preferences instead of expanding the tracker list', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('button', { name: 'More Factors' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Factors' }));
    expect(screen.getByRole('heading', { name: 'Customize factors' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/factors/preferences', expect.objectContaining({ method: 'PUT' })));
  });

  it('offers deletion only for a custom feeling and calls the archive endpoint', async () => {
    const api = mockApi(); vi.spyOn(window, 'confirm').mockReturnValue(true); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize feelings' }));
    expect(screen.queryByRole('button', { name: 'Remove Calm' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Centered' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/feelings/2', expect.objectContaining({ method: 'DELETE' })));
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
    fireEvent.click(option);
    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Add feelings')).toBeInTheDocument();
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

  it('converts 12-hour Sleep input and calculates overnight duration through Back', async () => {
    const api = mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Good, mood 4 of 5' }));
    for (let index = 0; index < 2; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Sleep', level: 1 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '11:30' } });
    fireEvent.change(screen.getByLabelText('Bedtime AM or PM'), { target: { value: 'PM' } });
    fireEvent.change(screen.getByLabelText('Wake Time'), { target: { value: '7:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Good 4/5' }));
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('7h 30m');
    expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Minutes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('11:30');
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('7h 30m');
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
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('7h 30m');
    expect(screen.getByLabelText('Bedtime')).toHaveValue('11:30');
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
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '12:50' } });
    fireEvent.change(screen.getByLabelText('Wake Time'), { target: { value: '9:50' } });
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('9h 0m');
    fireEvent.change(screen.getByLabelText('Wake Time'), { target: { value: '8:00' } });
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('7h 10m');
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
  ])('calculates %s %s to %s %s as %s', async (bed, bedPeriod, wake, wakePeriod, expected) => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: bed } });
    fireEvent.change(screen.getByLabelText('Bedtime AM or PM'), { target: { value: bedPeriod } });
    fireEvent.change(screen.getByLabelText('Wake Time'), { target: { value: wake } });
    fireEvent.change(screen.getByLabelText('Wake Time AM or PM'), { target: { value: wakePeriod } });
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent(expected);
  });

  it.each(['Bedtime', 'Wake Time'])('does not calculate duration with only %s', async (field) => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText(field), { target: { value: '1:30' } });
    expect(screen.queryByLabelText('Estimated sleep duration')).not.toBeInTheDocument();
    expect(screen.getByText('Enter both Sleep times to calculate a duration.')).toBeInTheDocument();
  });

  it('allows intermediate 12-hour typing but blocks Next until the value is complete', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const bedtime = screen.getByLabelText('Bedtime');
    fireEvent.change(bedtime, { target: { value: '1' } });
    expect(bedtime).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(bedtime, { target: { value: '1:3' } });
    expect(bedtime).toHaveValue('1:3');
    fireEvent.change(bedtime, { target: { value: '1:30' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('does not carry an unsaved Sleep draft into a newly opened Check-In', async () => {
    mockApi(); renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '11:30' } });
    cleanup();
    renderWizard();
    await screen.findByRole('heading', { name: 'Mood', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Bedtime')).toHaveValue('');
  });

  it('prefills and updates an existing Check-In without presenting daily Sleep as its child', async () => {
    const api = mockApi(); renderEditor();
    const mood = await screen.findByRole('button', { name: 'Good, mood 4 of 5' });
    expect(mood).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Generalized Pain: 0' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Headache: 0, None' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Factors', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sleep', level: 1 })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('heading', { name: 'History reached' }, { timeout: 1500 })).toBeInTheDocument();
    expect(api.savedBody()).toMatchObject({ mood: 4, pain: 0, symptoms: [{ symptomId: 10, severity: 0 }], factors: [{ factorId: 20, intensity: 2 }] });
    expect(api.savedBody()).not.toHaveProperty('sleep');
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
