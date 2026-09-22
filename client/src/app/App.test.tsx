// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { AuthProvider } from '../auth/AuthContext';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('App', () => {
  it('redirects an anonymous visitor to login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Please log in.' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows only the intended app links and safely redirects the old Tracking route Home', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, username: 'daniel' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app/tracking']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Tracking' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Home', 'Insights']);
  });

  it('opens Check-In from the single accessible Home action label', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
      if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: 1, username: 'daniel' } }), { status: 200, headers });
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, username: 'daniel' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<MemoryRouter initialEntries={['/app']}><AuthProvider><App /></AuthProvider></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
    expect(screen.getByTestId('cat-room-scene')).toBeInTheDocument();
    const cat = screen.getByRole('img', { name: 'Mochi the cat resting' });
    expect(cat).toHaveAttribute('data-frame-count', '10');
    expect(cat).toHaveAttribute('data-frame-size', '32x32');
    expect(cat.querySelector('img')).toHaveAttribute('src', expect.stringContaining('idle.png'));
  });
});
