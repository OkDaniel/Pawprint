// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Home', 'History', 'Insights']);
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
});
