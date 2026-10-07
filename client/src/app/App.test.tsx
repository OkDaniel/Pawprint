// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { AuthProvider } from '../auth/AuthContext';
import { isOnboardingPreviewEnabled } from './onboardingPreviewMode';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function moodTrendResponse() {
  return {
    range: { startLogicalDate: '2026-09-01', endLogicalDate: '2026-09-30', days: 30 },
    summary: { trackedDays: 1, totalCheckIns: 1, averageMood: 3 },
    points: Array.from({ length: 30 }, (_, index) => ({
      logicalDate: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
      moodMean: index === 0 ? 3 : null,
      checkInCount: index === 0 ? 1 : 0,
    })),
  };
}

function TestBrowserBackButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Simulate browser Back</button>;
}

function TestCheckInCompletionTrigger() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <button type="button" onClick={() => navigate('/app', { state: { justCompletedCheckIn: true } })}>Simulate successful Check-In</button>
    <output data-testid="home-navigation-state">{JSON.stringify(location.state)}</output>
  </>;
}

describe('App', () => {
  it('excludes the onboarding preview route from production mode', () => {
    expect(isOnboardingPreviewEnabled('production')).toBe(false);
    expect(isOnboardingPreviewEnabled('development')).toBe(true);
    expect(isOnboardingPreviewEnabled('test')).toBe(true);
  });

  it('redirects an anonymous visitor to login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Please log in.' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('routes an incomplete authenticated user to onboarding and a completed user away from it', async () => {
    const headers = { 'Content-Type': 'application/json' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'new-user', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: false } }), { status: 200, headers });
      if (url === '/api/feelings') return new Response(JSON.stringify({ feelings: [] }), { status: 200, headers });
      if (url === '/api/factors') return new Response(JSON.stringify({ factors: [] }), { status: 200, headers });
      if (url.startsWith('/api/symptoms?')) return new Response(JSON.stringify({ symptoms: [] }), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    const first = render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Welcome to Pawprint' })).toBeInTheDocument();
    first.unmount();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 2, username: 'returning', catAppearance: 'mochi-grey', catName: 'Luna', onboardingCompleted: true } }), { status: 200, headers }));
    render(<MemoryRouter initialEntries={['/onboarding']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome to Pawprint' })).not.toBeInTheDocument();
  });

  it('allows a completed authenticated user to open the development-only onboarding preview', async () => {
    const headers = { 'Content-Type': 'application/json' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'okidaniel', catAppearance: 'mochi-grey', catName: 'Mochii', onboardingCompleted: true } }), { status: 200, headers });
      if (url === '/api/feelings') return new Response(JSON.stringify({ feelings: [] }), { status: 200, headers });
      if (url === '/api/factors') return new Response(JSON.stringify({ factors: [] }), { status: 200, headers });
      if (url.startsWith('/api/symptoms?')) return new Response(JSON.stringify({ symptoms: [] }), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/onboarding-preview']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByText('Onboarding preview')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome to Pawprint' })).toBeInTheDocument();
  });

  it('keeps the loading state stable until auth resolves, then applies the onboarding gate', async () => {
    let resolveAuth!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input) !== '/api/auth/me') return Promise.resolve(new Response(JSON.stringify({ feelings: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return new Promise<Response>((resolve) => { resolveAuth = resolve; });
    });
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Pawprint');
    resolveAuth(new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
  });

  it('uses the Pawprint brand as the single Home link and safely redirects the old Tracking route Home', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app/tracking']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pawprint' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('keeps the Home action regions and opens Insights as a modal over Room5', async () => {
    const headers = { 'Content-Type': 'application/json' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers });
      if (url === '/api/insights/mood-trend') return new Response(JSON.stringify(moodTrendResponse()), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Cat Room' });
    const main = screen.getByRole('main');
    const checkIn = within(main).getByRole('link', { name: 'Check In' });
    const insights = within(main).getByRole('link', { name: 'Insights' });
    const history = within(main).getByRole('link', { name: 'History' });
    const leftRegion = checkIn.closest('[data-home-action-region]');
    const rightRegion = history.closest('[data-home-action-region]');

    expect(leftRegion).toHaveAttribute('data-home-action-region', 'left');
    expect(insights.closest('[data-home-action-region]')).toBe(leftRegion);
    expect(rightRegion).toHaveAttribute('data-home-action-region', 'right');
    expect(rightRegion).not.toBe(leftRegion);
    expect(screen.getByTestId('cat-room-scene')).toBeInTheDocument();
    expect(insights).toHaveAttribute('href', '/app/insights');
    expect(insights.querySelector('[data-pixel-text="INSIGHTS"]')).not.toBeNull();
    expect(insights.querySelector('img')).toHaveAttribute('src', expect.stringContaining('insights-magnifier.png'));
    fireEvent.click(insights);

    const insightsDialog = await screen.findByRole('dialog', { name: 'Insights' });
    expect(within(insightsDialog).getByRole('heading', { name: 'Insights', level: 1 })).toBeInTheDocument();
    expect(within(insightsDialog).getByText("A look back at what you've been tracking.")).toBeInTheDocument();
    expect(await within(insightsDialog).findByRole('heading', { name: 'Mood over the last 30 days' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(screen.getByTestId('cat-room-scene')).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    const close = within(insightsDialog).getByRole('button', { name: 'Close Insights' });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Insights' })).not.toBeInTheDocument());
    await waitFor(() => expect(insights).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Home behind a direct Insights route and lets browser Back close the modal', async () => {
    const headers = { 'Content-Type': 'application/json' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers });
      if (url === '/api/insights/mood-trend') return new Response(JSON.stringify(moodTrendResponse()), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/app', '/app/insights']} initialIndex={1}><AuthProvider><App /><TestBrowserBackButton /></AuthProvider></MemoryRouter>);

    expect(await screen.findByRole('dialog', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate browser Back' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Insights' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Insights' })).toHaveFocus());
  });

  it('opens Check-In from the single accessible Home action label', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/feelings' || url === '/api/factors' || url.startsWith('/api/symptoms?')) return new Response(JSON.stringify(url === '/api/feelings' ? { feelings: [] } : url === '/api/factors' ? { factors: [] } : { symptoms: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Cat Room' });
    const checkIn = await within(screen.getByRole('main')).findByRole('link', { name: 'Check In' });
    expect(checkIn.querySelector('[data-pixel-text="CHECK IN"]')).not.toBeNull();
    expect(checkIn.querySelector('img')).toHaveAttribute('src', expect.stringContaining('check-in-heart.png'));
    fireEvent.click(checkIn);
    expect(await screen.findByRole('heading', { name: 'Mood', level: 1 })).toBeInTheDocument();
  });

  it('opens History as a modal over Home and returns focus when it closes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const headers = { 'Content-Type': 'application/json' };
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers });
      if (url === '/api/check-ins') return new Response(JSON.stringify({ checkIns: [] }), { status: 200, headers });
      if (url === '/api/sleep') return new Response(JSON.stringify({ sleepEntries: [] }), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Cat Room' });
    const history = within(screen.getByRole('main')).getByRole('link', { name: 'History' });
    expect(history.querySelector('[data-pixel-text="HISTORY"]')).not.toBeNull();
    expect(history.querySelector('img')).toHaveAttribute('src', expect.stringContaining('history-gameboy.png'));
    fireEvent.click(history);
    const historyDialog = await screen.findByRole('dialog', { name: 'History' });
    expect(within(historyDialog).getByRole('heading', { name: 'History', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(within(historyDialog).getByRole('button', { name: 'Close History' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'History' })).not.toBeInTheDocument());
    await waitFor(() => expect(history).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
  });

  it('renders the empty room scene with the ten-frame idle cat', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(screen.getByTestId('cat-room-scene')).toBeInTheDocument();
    expect(screen.queryByText('Mochi', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByTestId('room-background')).toHaveAttribute('src', expect.stringContaining('room5'));
    expect(screen.getByRole('img', { name: 'Orange Mochi the cat resting' })).toHaveAttribute('data-animation', 'idle');
    const cat = screen.getByRole('img', { name: 'Orange Mochi the cat resting' });
    expect(cat).toHaveAttribute('data-appearance', 'mochi-orange');
    expect(cat).toHaveAttribute('data-frame-count', '10');
    expect(cat).toHaveAttribute('data-frame-size', '32x32');
    expect(cat.querySelector('img')).toHaveAttribute('src', expect.stringContaining('mochi-orange-idle.png'));
  });

  it('consumes a successful Check-In signal once, celebrates for one cycle, and returns Mochi to idle', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const view = render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /><TestCheckInCompletionTrigger /></AuthProvider></MemoryRouter>);

    const initialCat = await screen.findByRole('img', { name: 'Orange Mochi the cat resting' });
    const idleSheet = initialCat.querySelector('img')!;
    fireEvent.click(screen.getByRole('button', { name: 'Simulate successful Check-In' }));
    const excitedCat = await screen.findByRole('img', { name: 'Orange Mochi the cat excited' });
    const excitedSheet = excitedCat.querySelector('img')!;
    expect(excitedCat).toHaveAttribute('data-animation', 'excited');
    expect(excitedCat).toHaveAttribute('data-loop', 'false');
    expect(excitedCat).toHaveAttribute('data-frame-count', '12');
    expect(excitedCat).toHaveAttribute('data-frame-duration', '140');
    expect(excitedSheet).not.toBe(idleSheet);
    expect(screen.getByText('Check-In complete. Mochi is cheering for you.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('home-navigation-state')).toHaveTextContent('null'));
    expect(screen.getByRole('img', { name: 'Orange Mochi the cat excited' }).querySelector('img')).toBe(excitedSheet);
    fireEvent.animationEnd(idleSheet);
    expect(screen.getByRole('img', { name: 'Orange Mochi the cat excited' })).toBeInTheDocument();
    fireEvent.animationEnd(excitedSheet);

    const idleCat = await screen.findByRole('img', { name: 'Orange Mochi the cat resting' });
    expect(idleCat).toHaveAttribute('data-animation', 'idle');
    expect(screen.queryByText('Check-In complete. Mochi is cheering for you.')).not.toBeInTheDocument();

    view.unmount();
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('img', { name: 'Orange Mochi the cat resting' })).toHaveAttribute('data-animation', 'idle');
    expect(screen.queryByText('Check-In complete. Mochi is cheering for you.')).not.toBeInTheDocument();
  });

  it('updates the persisted appearance from the username account control and rerenders Home immediately', async () => {
    let updateBody: unknown;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = { 'Content-Type': 'application/json' };
      if (url === '/api/auth/me' && init?.method === 'PATCH') {
        updateBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-grey', catName: 'Luna', onboardingCompleted: true } }), { status: 200, headers });
      }
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true } }), { status: 200, headers });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);

    expect(await screen.findByRole('img', { name: 'Orange Mochi the cat resting' })).toBeInTheDocument();
    const accountButton = screen.getByRole('button', { name: /daniel/ });
    fireEvent.click(accountButton);
    let dialog = screen.getByRole('dialog', { name: 'Account' });
    expect(within(dialog).getByRole('radio', { name: /Orange/ })).toBeChecked();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(accountButton).toHaveFocus();

    fireEvent.click(accountButton);
    dialog = screen.getByRole('dialog', { name: 'Account' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Grey/ }));
    fireEvent.change(within(dialog).getByLabelText('Cat name'), { target: { value: 'Luna' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ method: 'PATCH' })));
    expect(updateBody).toEqual({ catAppearance: 'mochi-grey', catName: 'Luna' });
    expect(await screen.findByRole('img', { name: 'Grey Mochi the cat resting' })).toHaveAttribute('data-appearance', 'mochi-grey');
    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('shows the post-onboarding Home hint once and lets the user dismiss it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, username: 'daniel', catAppearance: 'mochi-white', catName: 'Snow', onboardingCompleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={[{ pathname: '/app', state: { justCompletedOnboarding: true, catName: 'Snow' } }]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByText("Snow is settled in. Start with Check In whenever you’re ready.")).toBeInTheDocument();
    expect(screen.queryByText('Snow', { selector: 'p' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss welcome message' }));
    expect(screen.queryByText("Snow is settled in. Start with Check In whenever you’re ready.")).not.toBeInTheDocument();
  });
});
