// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { transferableAbortController } from 'node:util';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devCoinGrantRequestSchema } from '@capstone/shared';
import { AuthProvider } from '../auth/AuthContext';
import { App } from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function mount({ mode = 'development', route = '/app', handler }: {
  mode?: string; route?: string; handler?: (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
} = {}) {
  vi.stubEnv('MODE', mode);
  vi.stubGlobal('AbortController', class { constructor() { return transferableAbortController(); } });
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input); const override = await handler?.(url, init); if (override) return override;
    if (url === '/api/auth/me') return json({ user: { id: 7, username: 'coin_user', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true } });
    if (url === '/api/economy/catalog') return json({ products: [], devCoinGrantsEnabled: true });
    if (url === '/api/economy/wallet') return json({ wallet: { balance: 10 } });
    if (url === '/api/economy/inventory') return json({ inventory: [] });
    if (url === '/api/economy/coats') return json({ coats: ['mochi-classic'] });
    if (url === '/api/economy/sync') return json({ rewardsGranted: 0, inspectedDates: [] });
    if (url === '/api/room/floor-layout') return json({ placements: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  const router = createMemoryRouter([{ path: '*', element: <AuthProvider><App /></AuthProvider> }], { initialEntries: [route] });
  render(<RouterProvider router={router} />);
  return fetch;
}

describe('development header coins', () => {
  it('shows the enabled development button between the existing account and logout controls', async () => {
    mount();
    const button = await screen.findByRole('button', { name: '🪙 +100 Coins' });
    expect(button).toHaveAttribute('title', 'Development only: grant 100 test coins');
    expect(within(screen.getByRole('banner')).getAllByRole('button').map(b => b.textContent)).toEqual(['coin_user▾', '🪙 +100 Coins', 'Log out']);
  });

  it.each(['disabled', 'failed'])('hides the button when the authenticated capability is %s', async state => {
    const fetch = mount({ handler: url => url === '/api/economy/catalog'
      ? state === 'disabled' ? json({ products: [], devCoinGrantsEnabled: false }) : json({ error: { message: 'Offline.' } }, 503)
      : undefined });
    await screen.findByRole('button', { name: 'Log out' });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/economy/catalog', expect.anything()));
    expect(screen.queryByRole('button', { name: /100 Coins/ })).not.toBeInTheDocument();
  });

  it('excludes the control and capability/grant calls in production even when the server flag is enabled', async () => {
    const fetch = mount({ mode: 'production' });
    await screen.findByRole('button', { name: 'Log out' });
    expect(screen.queryByRole('button', { name: /100 Coins/ })).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => ['/api/economy/catalog', '/api/dev/coins/grants'].includes(String(url)))).toBe(false);
  });

  it('grants 100 with a valid unique UUID per intent and refreshes the open Store from the server wallet', async () => {
    let balance = 10; const commands: { amount: number; requestId: string }[] = [];
    mount({ route: '/app/store', handler: (url, init) => {
      if (url === '/api/economy/wallet') return json({ wallet: { balance } });
      if (url === '/api/dev/coins/grants') {
        commands.push(devCoinGrantRequestSchema.parse(JSON.parse(String(init?.body))));
        balance += 100; return json({ grant: { transactionId: commands.length, balance } });
      }
    } });
    const store = await screen.findByRole('dialog', { name: 'Store' }, { timeout: 5000 });
    expect(await within(store).findByLabelText('Coin balance')).toHaveTextContent('10 coins');
    const button = await screen.findByRole('button', { name: '🪙 +100 Coins' });
    fireEvent.click(button);
    await screen.findByText('100 test coins added.');
    expect(within(store).getByLabelText('Coin balance')).toHaveTextContent('110 coins');
    expect(within(store).getByRole('button', { name: '+10 test coins' })).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(within(store).getByLabelText('Coin balance')).toHaveTextContent('210 coins'));
    expect(commands.map(c => c.amount)).toEqual([100, 100]);
    expect(commands[0]!.requestId).not.toEqual(commands[1]!.requestId);
  });

  it('disables processing and prevents double submissions', async () => {
    let resolve!: (value: Response) => void; let calls = 0;
    mount({ handler: url => url === '/api/dev/coins/grants' ? (calls++, new Promise<Response>(done => { resolve = done; })) : undefined });
    const button = await screen.findByRole('button', { name: '🪙 +100 Coins' });
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole('button', { name: '🪙 Adding…' })).toBeDisabled();
    await waitFor(() => expect(calls).toBe(1));
    resolve(json({ grant: { transactionId: 1, balance: 110 } }));
    await screen.findByText('100 test coins added.');
  });

  it('reuses the identical UUID and amount after an uncertain result', async () => {
    const commands: unknown[] = [];
    mount({ handler: (url, init) => {
      if (url === '/api/dev/coins/grants') {
        commands.push(JSON.parse(String(init?.body)));
        return commands.length === 1 ? json({ error: { message: 'Uncertain.' } }, 503) : json({ grant: { transactionId: 1, balance: 110 } });
      }
    } });
    fireEvent.click(await screen.findByRole('button', { name: '🪙 +100 Coins' }));
    fireEvent.click(await screen.findByRole('button', { name: '🪙 Retry +100 Coins' }));
    await screen.findByText('100 test coins added.');
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1]);
  });

  it('does not retry a confirmed grant when only wallet refresh fails', async () => {
    let grants = 0;
    mount({ handler: url => {
      if (url === '/api/dev/coins/grants') { grants++; return json({ grant: { transactionId: 1, balance: 110 } }); }
      if (url === '/api/economy/wallet') return json({ error: { message: 'Wallet offline.' } }, 503);
    } });
    fireEvent.click(await screen.findByRole('button', { name: '🪙 +100 Coins' }));
    await screen.findByText(/100 test coins added. Wallet refresh unavailable/);
    expect(grants).toBe(1);
    expect(screen.getByRole('button', { name: '🪙 +100 Coins' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '🪙 Retry +100 Coins' })).not.toBeInTheDocument();
  });

  it('hides the control if the enabled endpoint becomes unavailable', async () => {
    mount({ handler: url => url === '/api/dev/coins/grants' ? json({ error: { message: 'Not found.' } }, 404) : undefined });
    fireEvent.click(await screen.findByRole('button', { name: '🪙 +100 Coins' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /100 Coins/ })).not.toBeInTheDocument());
  });
});
