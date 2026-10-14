// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { transferableAbortController } from 'node:util';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { floorDecorations, catAppearanceKeys, floorScenePoint } from '@capstone/shared';
import { AuthProvider } from '../../auth/AuthContext';
import { App } from '../../app/App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });
const products = [...floorDecorations.map(p => ({ id: p.id, kind: 'decoration', price: 1, purchasable: true, retired: false })), ...catAppearanceKeys.map(id => ({ id, kind: 'coat', price: 1, purchasable: true, retired: false }))];
const user = { id: 7, username: 'store_user', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: true };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function mount(handler?: (url: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  vi.stubGlobal('AbortController', class { constructor() { return transferableAbortController(); } });
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input); const override = await handler?.(url, init); if (override) return override;
    if (url === '/api/auth/me') return json({ user });
    if (url === '/api/economy/catalog') return json({ products, devCoinGrantsEnabled: false });
    if (url === '/api/economy/wallet') return json({ wallet: { balance: 10 } });
    if (url === '/api/economy/inventory') return json({ inventory: [] });
    if (url === '/api/economy/coats') return json({ coats: ['mochi-classic'] });
    if (url === '/api/economy/sync') return json({ rewardsGranted: 0, inspectedDates: [] });
    if (url === '/api/room/floor-layout') return json({ placements: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  const router = createMemoryRouter([{ path: '*', element: <AuthProvider><App /></AuthProvider> }], { initialEntries: ['/app', '/app/store'], initialIndex: 1 });
  render(<RouterProvider router={router} />); return { fetch, router };
}
describe('Store shell and server catalog', () => {
  it('does not display disabled, retired or unpriced products and honors server prices', async () => {
    mount(url => url === '/api/economy/catalog' ? json({ products: products.map(p => p.id === 'decor_yarn_ball' ? { ...p, price: 7 } : p.id === 'decor_bowl' ? { ...p, purchasable: false } : p.id === 'decor_tin_round' ? { ...p, retired: true } : p.id === 'decor_toy_block' ? { ...p, price: null } : p), devCoinGrantsEnabled: false }) : undefined);
    // The first lazy Store import may take longer under the full workspace run.
    const store = await screen.findByRole('dialog', { name: 'Store' }, { timeout: 5000 });
    const yarn = await within(store).findByRole('article', { name: 'Yarn Ball' });
    expect(within(yarn).getByText('7 coins')).toBeInTheDocument();
    expect(within(store).queryByRole('article', { name: 'Cat Bowl' })).not.toBeInTheDocument();
    expect(within(store).queryByRole('article', { name: 'Cat Food Tin' })).not.toBeInTheDocument();
    expect(within(store).queryByRole('article', { name: 'Toy Block' })).not.toBeInTheDocument();
  });
  it('shows catalog loading and failure with a working retry', async () => {
    let resolve!: (response: Response) => void;
    let fail = true;
    mount(url => url === '/api/economy/catalog' && fail ? new Promise<Response>(done => { resolve = done; }) : undefined);
    const store = await screen.findByRole('dialog', { name: 'Store' });
    expect(within(store).getByText('Loading the Shop…')).toBeInTheDocument();
    await act(async () => { resolve(json({ error: { code: 'UNAVAILABLE', message: 'Shop offline.' } }, 500)); });
    expect(await within(store).findByText(/Shop offline/)).toBeInTheDocument();
    fail = false; fireEvent.click(within(store).getByRole('button', { name: 'Retry Shop' }));
    expect(await within(store).findAllByRole('article')).toHaveLength(20);
  });
  it('shows authoritative prices/balance, all usable enabled products and approved finishes', async () => {
    mount(url => url === '/api/economy/catalog' ? json({ products: [...products, { id: 'unsupported', kind: 'decoration', price: 0, purchasable: true, retired: false }], devCoinGrantsEnabled: false }) : undefined);
    const store = await screen.findByRole('dialog', { name: 'Store' });
    expect(await within(store).findByLabelText('Coin balance')).toHaveTextContent('10 coins');
    expect(await within(store).findAllByRole('article')).toHaveLength(20);
    const yarn = within(store).getByRole('article', { name: 'Yarn Ball' });
    expect(within(yarn).getByText('1 coin')).toBeInTheDocument();
    fireEvent.change(within(yarn).getByLabelText('Finish'), { target: { value: 'decor_yarn_ball_red' } });
    expect(within(yarn).getByRole('img')).toHaveAttribute('src', expect.stringContaining('room_decor_003_v05'));
    fireEvent.click(within(store).getByRole('button', { name: 'Plants' }));
    expect(within(store).getAllByRole('article')).toHaveLength(2);
    expect(within(store).queryByRole('button', { name: /test coins/ })).not.toBeInTheDocument();
  });
  it('keeps Home mounted, traps focus, closes on Escape and restores the Store trigger', async () => {
    mount();
    const store = await screen.findByRole('dialog', { name: 'Store' });
    const close = within(store).getByRole('button', { name: 'Close Store' });
    await waitFor(() => expect(close).toHaveFocus()); expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await screen.findByRole('heading', { name: 'Cat Room' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Store' })).not.toBeInTheDocument());
  });
  it('shows independent wallet failure and retry while the Shop remains available', async () => {
    let fail = true;
    mount(url => url === '/api/economy/wallet' && fail ? json({ error: { code: 'WALLET_UNAVAILABLE', message: 'Wallet offline.' } }, 500) : undefined);
    const store = await screen.findByRole('dialog', { name: 'Store' });
    expect(await within(store).findByText(/Wallet offline/)).toBeInTheDocument();
    expect(within(store).getAllByRole('article')).toHaveLength(20);
    fail = false; fireEvent.click(within(store).getByRole('button', { name: 'Retry wallet' }));
    expect(await within(store).findByText('10 coins')).toBeInTheDocument();
  });
});

describe('production Build draft workflow', () => {
  async function startBuild(handler?: (url: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
    const result = mount((url, init) => {
      const override = handler?.(url, init); if (override) return override;
      if (url === '/api/economy/inventory') return json({ inventory: [ownedItem(8), ownedItem(9)] });
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(within(store).getByRole('button', { name: 'Build' }));
    await within(store).findByRole('button', { name: /^Yarn Ball 1,/ });
    return { ...result, store };
  }
  function clickFloor(store: HTMLElement, u: number, v: number) {
    const overlay = within(store).getByTestId('build-room-scene').querySelector('svg')!;
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 512, height: 512 } as DOMRect);
    const [clientX, clientY] = floorScenePoint(u, v);
    fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY }));
  }
  it('places with one floor click, selects the room object and moves the draft before a full save', async () => {
    let saved: unknown;
    const { store } = await startBuild((url, init) => {
      if (url === '/api/room/floor-layout' && init?.method === 'PUT') {
        saved = JSON.parse(String(init.body));
        return json({ placements: [{ inventoryInstanceId: 8, gridU: 6, gridV: 5, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' }] });
      }
    });
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    clickFloor(store, 5, 5);
    expect(within(store).getByText('Yarn Ball 1 placed. Save room to keep this change.')).toBeInTheDocument();
    clickFloor(store, 11, 12);
    expect(within(store).getByText('Keep Mochi’s resting area clear.')).toBeInTheDocument();
    expect(within(store).getByText(/1 \/ 20 placed/)).toBeInTheDocument();
    expect(within(store).getByRole('button', { name: /^Yarn Ball 1,/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(store).getByRole('button', { name: 'Save room' })).toBeEnabled();
    fireEvent.click(within(store).getByRole('button', { name: 'Select Yarn Ball 1' }));
    clickFloor(store, 6, 5);
    expect(within(store).getByText('Yarn Ball 1 moved. Save room to keep this change.')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="cat-room-scene"] [data-scene-object="8"]')).toBeNull();
    fireEvent.click(within(store).getByRole('button', { name: 'Save room' }));
    await within(store).findByText('Room saved. Your arrangement is ready on Home.');
    expect(saved).toEqual({ placements: [{ inventoryInstanceId: 8, gridU: 6, gridV: 5 }] });
  });
  it('preserves selection and the draft after collision or reserved-space clicks and immediately recovers', async () => {
    const initial = { inventoryInstanceId: 8, gridU: 5, gridV: 5, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' };
    let saved: unknown;
    const { store } = await startBuild((url, init) => {
      if (url === '/api/room/floor-layout') {
        if (init?.method === 'PUT') {
          saved = JSON.parse(String(init.body));
          return json({ placements: [initial, { ...initial, inventoryInstanceId: 9, gridU: 8, gridV: 8 }] });
        }
        return json({ placements: [initial] });
      }
    });
    const selected = within(store).getByRole('button', { name: /^Yarn Ball 2,/ });
    fireEvent.click(selected);
    for (const [u, v] of [[5, 5], [11, 12]] as const) {
      clickFloor(store, u, v);
      expect(within(store).getByText(u === 5 ? 'The base overlaps another item. Choose a clear spot.' : 'Keep Mochi’s resting area clear.')).toBeInTheDocument();
      expect(selected).toHaveAttribute('aria-pressed', 'true');
      expect(within(store).getByText(/1 \/ 20 placed/)).toBeInTheDocument();
      expect(within(store).queryByRole('button', { name: 'Select Yarn Ball 2' })).not.toBeInTheDocument();
      expect(within(store).getByRole('button', { name: 'Save room' })).toBeDisabled();
    }
    expect(within(store).getByText('Keep Mochi’s resting area clear.')).toBeInTheDocument();
    clickFloor(store, 8, 8);
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(within(store).getByText(/2 \/ 20 placed/)).toBeInTheDocument();
    fireEvent.click(within(store).getByRole('button', { name: 'Save room' }));
    await within(store).findByText('Room saved. Your arrangement is ready on Home.');
    expect(saved).toEqual({ placements: [{ inventoryInstanceId: 8, gridU: 5, gridV: 5 }, { inventoryInstanceId: 9, gridU: 8, gridV: 8 }] });
  });
  it('protects a dirty draft on tab changes and discards without losing owned copies', async () => {
    const { store } = await startBuild();
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    clickFloor(store, 5, 5);
    fireEvent.click(within(store).getByRole('button', { name: 'Inventory' }));
    const confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }));
    expect(within(store).getByRole('button', { name: 'Save room' })).toBeEnabled();
    fireEvent.click(within(store).getByRole('button', { name: 'Inventory' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    await within(store).findByRole('heading', { name: 'Your collection' });
    expect(within(store).getAllByText('Not placed')).toHaveLength(2);
  });
  it('selects tiny items from the list, provides invalid feedback and saves the complete layout', async () => {
    let saved: unknown;
    const { store } = await startBuild((url, init) => {
      if (url === '/api/room/floor-layout' && init?.method === 'PUT') {
        saved = JSON.parse(String(init.body));
        return json({ placements: [{ inventoryInstanceId: 8, gridU: 8, gridV: 8, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' }] });
      }
    });
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    expect(within(store).queryByLabelText('Floor U')).not.toBeInTheDocument();
    expect(within(store).queryByLabelText('Floor V')).not.toBeInTheDocument();
    const adjust = within(store).getByRole('button', { name: 'Adjust position' });
    expect(adjust).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(adjust);
    expect(adjust).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(within(store).getByLabelText('Floor U'), { target: { value: '11' } });
    fireEvent.change(within(store).getByLabelText('Floor V'), { target: { value: '12' } });
    expect(within(store).getByText('Keep Mochi’s resting area clear.')).toBeInTheDocument();
    expect(within(store).getByRole('button', { name: 'Place here' })).toBeDisabled();
    fireEvent.change(within(store).getByLabelText('Floor U'), { target: { value: '8' } });
    fireEvent.change(within(store).getByLabelText('Floor V'), { target: { value: '8' } });
    fireEvent.click(within(store).getByRole('button', { name: 'Place here' }));
    expect(document.querySelector('[data-testid="cat-room-scene"] [data-scene-object="8"]')).toBeNull();
    fireEvent.click(within(store).getByRole('button', { name: 'Save room' }));
    await within(store).findByText('Room saved. Your arrangement is ready on Home.');
    expect(saved).toEqual({ placements: [{ inventoryInstanceId: 8, gridU: 8, gridV: 8 }] });
    expect(document.querySelector('[data-testid="cat-room-scene"] [data-scene-object="8"]')).not.toBeNull();
    expect(within(store).getByRole('button', { name: 'Save room' })).toBeDisabled();
  });
  it('retains the editable draft and original Home room when the server rejects a save', async () => {
    const { store } = await startBuild((url, init) => url === '/api/room/floor-layout' && init?.method === 'PUT' ? json({ error: { code: 'PLACEMENT_COLLISION', message: 'Layout rejected.' } }, 400) : undefined);
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    fireEvent.keyDown(within(store).getByRole('group', { name: 'Keyboard placement' }), { key: 'Enter' });
    fireEvent.click(within(store).getByRole('button', { name: 'Save room' }));
    expect(await within(store).findByText('Layout rejected.')).toBeInTheDocument();
    expect(within(store).getByRole('button', { name: 'Save room' })).toBeEnabled();
    expect(within(store).getByText(/1 \/ 20 placed/)).toBeInTheDocument();
    expect(document.querySelector('[data-testid="cat-room-scene"] [data-scene-object="8"]')).toBeNull();
    fireEvent.click(within(store).getByRole('button', { name: 'Discard changes' }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Discard changes' }));
    await within(store).findByRole('heading', { name: 'Your collection' });
    expect(within(store).getAllByText('Not placed')).toHaveLength(2);
  });
  it('blocks browser Back and Escape with unsaved edits, keeps editing or discards accessibly', async () => {
    const { store, router } = await startBuild();
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    fireEvent.keyDown(within(store).getByRole('group', { name: 'Keyboard placement' }), { key: 'Enter' });
    await act(async () => { await router.navigate(-1); });
    let confirmation = await screen.findByRole('alertdialog');
    expect(within(confirmation).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }));
    expect(within(store).getByRole('button', { name: 'Save room' })).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Store' })).not.toBeInTheDocument());
  });
  it('loads saved furniture, moves with keyboard controls and removes without deleting ownership', async () => {
    const { store } = await startBuild(url => url === '/api/room/floor-layout' ? json({ placements: [{ inventoryInstanceId: 8, gridU: 5, gridV: 5, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' }] }) : undefined);
    fireEvent.click(within(store).getByRole('button', { name: /^Yarn Ball 1,/ }));
    const keyboard = within(store).getByRole('group', { name: 'Keyboard placement' });
    fireEvent.keyDown(keyboard, { key: 'ArrowRight' });
    expect(within(store).queryByLabelText('Floor U')).not.toBeInTheDocument();
    fireEvent.keyDown(keyboard, { key: 'Enter' });
    expect(within(store).getByText('Yarn Ball 1 moved. Save room to keep this change.')).toBeInTheDocument();
    fireEvent.click(within(store).getByRole('button', { name: 'Adjust position' }));
    expect(within(store).getByLabelText('Floor U')).toHaveValue(6);
    fireEvent.click(within(store).getByRole('button', { name: 'Adjust position' }));
    expect(within(store).queryByLabelText('Floor U')).not.toBeInTheDocument();
    fireEvent.click(within(store).getByRole('button', { name: 'Remove from room' }));
    expect(within(store).getByRole('button', { name: /^Yarn Ball 1,/ })).toBeInTheDocument();
    expect(within(store).getByText(/0 \/ 20 placed/)).toBeInTheDocument();
  });
});

const ownedItem = (instanceId: number, selectedVariantId = 'decor_yarn_ball_sage') => ({ instanceId, productId: 'decor_yarn_ball', selectedVariantId, purchaseTransactionId: instanceId + 100, acquiredAt: '2026-10-07T12:00:00Z' });
describe('purchases, owned instances and coats', () => {
  it('restores an uncertain request after reopening and resolves an already-owned coat without another buy', async () => {
    const pending = { productId: 'mochi-grey', requestId: '11111111-1111-4111-8111-111111111111' };
    sessionStorage.setItem('pawprint:purchase:7', JSON.stringify(pending));
    let request: unknown;
    mount((url, init) => {
      if (url === '/api/economy/purchases') { request = JSON.parse(String(init?.body)); return json({ error: { code: 'COAT_ALREADY_OWNED', message: 'You already own that coat.' } }, 409); }
      if (url === '/api/economy/coats') return json({ coats: ['mochi-classic', 'mochi-grey'] });
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(within(store).getByRole('button', { name: 'Retry purchase' }));
    await within(store).findByText('You already own that coat.');
    expect(request).toEqual(pending);
    const grey = within(store).getByRole('article', { name: 'Grey Coat' });
    expect(await within(grey).findByRole('button', { name: 'Equip' })).toBeEnabled();
    expect(sessionStorage.getItem('pawprint:purchase:7')).toBeNull();
  });
  it('confirms a purchase, refreshes balance/inventory and applies the browsed finish for the returned instance', async () => {
    let purchased = false, finish = 'decor_yarn_ball_sage';
    const { fetch } = mount((url, init) => {
      if (url === '/api/economy/purchases') { purchased = true; return json({ purchase: { transactionId: 109, productId: 'decor_yarn_ball', inventoryInstanceId: 9, balance: 9 } }, 201); }
      if (url === '/api/economy/wallet') return json({ wallet: { balance: purchased ? 9 : 10 } });
      if (url === '/api/economy/inventory') return json({ inventory: purchased ? [ownedItem(9, finish)] : [] });
      if (url === '/api/economy/inventory/9/variant') { finish = JSON.parse(String(init?.body)).variantId; return json({ instance: ownedItem(9, finish) }); }
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    const yarn = await within(store).findByRole('article', { name: 'Yarn Ball' });
    await waitFor(() => expect(within(yarn).getByRole('button', { name: 'Buy Yarn Ball' })).toBeEnabled());
    fireEvent.change(within(yarn).getByLabelText('Finish'), { target: { value: 'decor_yarn_ball_red' } });
    fireEvent.click(within(yarn).getByRole('button', { name: 'Buy Yarn Ball' }));
    expect(await within(store).findByText('Purchased. Your item is ready in Inventory.')).toBeInTheDocument();
    expect(within(store).getByLabelText('Coin balance')).toHaveTextContent('9 coins');
    const command = JSON.parse(String(fetch.mock.calls.find(([url]) => url === '/api/economy/purchases')?.[1]?.body));
    expect(command).toEqual({ productId: 'decor_yarn_ball', requestId: expect.any(String) });
    fireEvent.click(within(store).getByRole('button', { name: 'Inventory' }));
    expect(await within(store).findByLabelText('Finish for Yarn Ball')).toHaveValue('decor_yarn_ball_red');
    expect(within(store).getByText('Not placed')).toBeInTheDocument();
  });
  it('reuses the identical uncertain request without granting local inventory or subtracting coins', async () => {
    const commands: unknown[] = []; let confirmed = false;
    mount((url, init) => {
      if (url === '/api/economy/purchases') {
        commands.push(JSON.parse(String(init?.body)));
        if (commands.length === 1) return json({ error: { code: 'NETWORK_FAILURE', message: 'Uncertain.' } }, 503);
        confirmed = true; return json({ purchase: { transactionId: 109, productId: 'decor_yarn_ball', inventoryInstanceId: 9, balance: 9 } });
      }
      if (url === '/api/economy/inventory') return json({ inventory: confirmed ? [ownedItem(9)] : [] });
      if (url === '/api/economy/wallet') return json({ wallet: { balance: confirmed ? 9 : 10 } });
      if (url === '/api/economy/inventory/9/variant') return json({ instance: ownedItem(9) });
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    await waitFor(() => expect(within(store).getByRole('button', { name: 'Buy Yarn Ball' })).toBeEnabled());
    fireEvent.click(within(store).getByRole('button', { name: 'Buy Yarn Ball' }));
    const retry = await within(store).findByRole('button', { name: 'Retry purchase' });
    expect(within(store).getByLabelText('Coin balance')).toHaveTextContent('10 coins');
    expect(within(store).getByRole('button', { name: 'Buy Yarn Ball' })).toBeDisabled();
    fireEvent.click(retry);
    await within(store).findByText('Purchased. Your item is ready in Inventory.');
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1]);
    expect(sessionStorage.getItem('pawprint:purchase:7')).toBeNull();
  });
  it('reports structured insufficient coins and does not pretend to own the item', async () => {
    mount(url => url === '/api/economy/purchases' ? json({ error: { code: 'INSUFFICIENT_COINS', message: 'You do not have enough coins.' } }, 409) : undefined);
    const store = await screen.findByRole('dialog', { name: 'Store' });
    await waitFor(() => expect(within(store).getByRole('button', { name: 'Buy Yarn Ball' })).toBeEnabled());
    fireEvent.click(within(store).getByRole('button', { name: 'Buy Yarn Ball' }));
    expect(await within(store).findByText('You do not have enough coins.')).toBeInTheDocument();
    fireEvent.click(within(store).getByRole('button', { name: 'Inventory' }));
    expect(await within(store).findByText(/No decorations yet/)).toBeInTheDocument();
  });
  it('keeps duplicate instance identity, recolors the chosen instance and updates the placed Home object', async () => {
    mount((url, init) => {
      if (url === '/api/economy/inventory') return json({ inventory: [ownedItem(8), ownedItem(9)] });
      if (url === '/api/room/floor-layout') return json({ placements: [{ inventoryInstanceId: 8, gridU: 4, gridV: 4, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' }] });
      if (url === '/api/economy/inventory/8/variant') return json({ instance: ownedItem(8, JSON.parse(String(init?.body)).variantId) });
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(within(store).getByRole('button', { name: 'Inventory' }));
    const finish = await within(store).findByLabelText('Finish for Yarn Ball 1');
    expect(within(store).getByText('In room')).toBeInTheDocument(); expect(within(store).getByText('Not placed')).toBeInTheDocument();
    fireEvent.change(finish, { target: { value: 'decor_yarn_ball_red' } });
    await within(store).findByText('Finish updated.');
    expect(finish).toHaveValue('decor_yarn_ball_red');
    expect(within(store).getByLabelText('Finish for Yarn Ball 2')).toHaveValue('decor_yarn_ball_sage');
    expect(document.querySelector('[data-scene-object="8"]')).toHaveAttribute('data-variant', 'decor_yarn_ball_red');
  });
  it('shows owned/equipped coats and equips only through the authenticated API', async () => {
    let update: unknown;
    mount((url, init) => {
      if (url === '/api/economy/coats') return json({ coats: ['mochi-classic', 'mochi-grey'] });
      if (url === '/api/auth/me' && init?.method === 'PATCH') { update = JSON.parse(String(init.body)); return json({ user: { ...user, catAppearance: 'mochi-grey' } }); }
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(await within(store).findByRole('button', { name: 'Cat Coats' }));
    const grey = await within(store).findByRole('article', { name: 'Grey Coat' });
    fireEvent.click(await within(grey).findByRole('button', { name: 'Equip' }));
    await within(store).findByText('Coat equipped.');
    expect(update).toEqual({ catAppearance: 'mochi-grey', catName: 'Mochi' });
    expect(within(grey).getByRole('button', { name: 'Equipped' })).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Grey Mochi the cat resting' })).toBeInTheDocument();
  });
});

describe('tracking/game fault isolation', () => {
  it('keeps Check-In reachable when a decoration image fails', async () => {
    mount(url => {
      if (url === '/api/room/floor-layout') return json({ placements: [{ inventoryInstanceId: 8, gridU: 8, gridV: 8, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' }] });
      if (url === '/api/feelings') return json({ feelings: [] });
      if (url === '/api/factors') return json({ factors: [] });
      if (url.startsWith('/api/symptoms?')) return json({ symptoms: [] });
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    const scene = screen.getByTestId('cat-room-scene');
    fireEvent.error(await within(scene).findByRole('img', { name: 'Yarn Ball' }));
    fireEvent.click(within(store).getByRole('button', { name: 'Close Store' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Store' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: 'Check In' }));
    expect(await screen.findByRole('heading', { name: 'Mood', level: 1 })).toBeInTheDocument();
  });
  it('keeps Room5 and the animated cat available, and saves Check-In after all game GETs fail', async () => {
    let saved: Record<string, unknown> | undefined;
    mount((url, init) => {
      if (url.startsWith('/api/economy/') || url === '/api/room/floor-layout') return json({ error: { code: 'GAME_OFFLINE', message: 'Game offline.' } }, 503);
      if (url === '/api/feelings') return json({ feelings: [] });
      if (url === '/api/factors') return json({ factors: [] });
      if (url.startsWith('/api/symptoms?')) return json({ symptoms: [] });
      if (url === '/api/sleep/current') return json({ sleep: null });
      if (url === '/api/check-ins' && init?.method === 'POST') {
        saved = JSON.parse(String(init.body));
        return json({ checkIn: {} }, 201);
      }
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    await within(store).findByRole('button', { name: 'Retry Shop' });
    expect(screen.getByTestId('room-background')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mochi the cat resting' })).toHaveAttribute('data-animation', 'idle');
    fireEvent.click(within(store).getByRole('button', { name: 'Close Store' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Store' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: 'Check In' }));
    expect(await screen.findByRole('heading', { name: 'Mood', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Okay, mood 3 of 5' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    for (let index = 0; index < 3; index++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
    expect(await screen.findByText('Check-In complete. Mochi is cheering for you.')).toBeInTheDocument();
    expect(saved).toMatchObject({ mood: 3, feelingIds: [], symptoms: [], factors: [] });
    expect(saved?.clientRequestId).toEqual(expect.any(String));
    expect(screen.getByTestId('room-background')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Mochi.*excited/i })).toHaveAttribute('data-animation', 'excited');
  });
});

describe('explicitly enabled development grants', () => {
  it('reuses the request for an uncertain +10 grant and refreshes the server balance', async () => {
    const commands: unknown[] = []; let balance = 0;
    mount((url, init) => {
      if (url === '/api/economy/catalog') return json({ products, devCoinGrantsEnabled: true });
      if (url === '/api/economy/wallet') return json({ wallet: { balance } });
      if (url === '/api/dev/coins/grants') {
        commands.push(JSON.parse(String(init?.body)));
        if (commands.length === 1) return json({ error: { code: 'OFFLINE', message: 'Offline.' } }, 503);
        balance = 10; return json({ grant: { transactionId: 3, balance } });
      }
    });
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(await within(store).findByRole('button', { name: '+10 test coins' }));
    await within(store).findByText('Test grant couldn’t be confirmed. Retry with the same request.');
    fireEvent.click(within(store).getByRole('button', { name: '+10 test coins' }));
    await within(store).findByText('10 test coins added.');
    expect(commands[0]).toEqual(commands[1]);
    expect(within(store).getByLabelText('Coin balance')).toHaveTextContent('10 coins');
  });
  it('hides an unavailable development grant after its authenticated 404 response', async () => {
    mount(url => url === '/api/economy/catalog' ? json({ products, devCoinGrantsEnabled: true }) : url === '/api/dev/coins/grants' ? json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404) : undefined);
    const store = await screen.findByRole('dialog', { name: 'Store' });
    fireEvent.click(await within(store).findByRole('button', { name: '+10 test coins' }));
    await waitFor(() => expect(within(store).queryByRole('button', { name: '+10 test coins' })).not.toBeInTheDocument());
  });
});
