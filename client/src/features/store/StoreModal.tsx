import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import type { CatAppearanceKey, InventoryInstanceResponse, InventoryResponse, OwnedCoatsResponse, PurchaseResponse, StoreCatalogResponse, WalletResponse } from '@capstone/shared';
import { ApiError, apiRequest } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { useRoom } from '../room/roomContext';
import { useResource } from '../room/useResource';
import { Shop } from './Shop';
import { Inventory } from './Inventory';
import { readPending, storePending, type PendingPurchase } from './pendingTransaction';
import { BuildMode } from './BuildMode';
import { ConfirmDialog } from '../checkIn/ConfirmDialog';
import { GameBoundary } from '../room/GameBoundary';
import styles from './Store.module.css';
import { WALLET_UPDATED_EVENT } from './walletUpdates';

export function StoreModal() {
  const { user, updateCompanion } = useAuth();
  const room = useRoom();
  const navigate = useNavigate();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'shop' | 'inventory' | 'build'>('shop');
  const catalog = useResource<StoreCatalogResponse>('/api/economy/catalog');
  const wallet = useResource<WalletResponse>('/api/economy/wallet');
  const reloadWallet = wallet.reload;
  const confirmWallet = wallet.confirm;
  const reloadRoom = room.reload;
  const inventory = useResource<InventoryResponse>('/api/economy/inventory');
  const coats = useResource<OwnedCoatsResponse>('/api/economy/coats');
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(() => readPending(user!.id));
  const grantRequest = useRef<string | null>(null);
  const [grantUnavailable, setGrantUnavailable] = useState(false);
  const [buildSelection, setBuildSelection] = useState<number | undefined>();
  const [dirty, setDirty] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const blocker = useBlocker(dirty);
  const leaving = Boolean(leaveAction) || blocker.state === 'blocked';
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; setMessage(''); }, [view]);
  const savingRef = useRef(false);
  savingRef.current = savingRoom;
  const requestView = (next: typeof view) => {
    if (next === view || savingRoom) return;
    if (dirty) setLeaveAction(() => () => setView(next));
    else setView(next);
  };

  useEffect(() => {
    const updated = (event: Event) => {
      const confirmed = (event as CustomEvent<WalletResponse | undefined>).detail;
      if (confirmed) confirmWallet(confirmed);
      else void reloadWallet();
    };
    window.addEventListener(WALLET_UPDATED_EVENT, updated);
    return () => window.removeEventListener(WALLET_UPDATED_EVENT, updated);
  }, [confirmWallet, reloadWallet]);

  useEffect(() => {
    // Bounded server reconciliation can repair a missed post-Check-In reward.
    void apiRequest('/api/economy/sync', { method: 'POST' }).then(() => reloadWallet()).catch(() => {});
    void reloadRoom();
  }, [reloadWallet, reloadRoom]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function remember(purchase: PendingPurchase | null) { setPending(purchase); storePending(user!.id, purchase); }
  async function purchase(productId: string, variantId?: string) {
    if (mutation.current) return;
    const command = pending ?? { productId, variantId, requestId: crypto.randomUUID() };
    mutation.current = true; setBusy(true); setFailure(''); setMessage(''); remember(command);
    let confirmed = false;
    try {
      const { purchase: result } = await apiRequest<PurchaseResponse>('/api/economy/purchases', { method: 'POST', body: JSON.stringify({ productId: command.productId, requestId: command.requestId }) });
      confirmed = true; remember(null); wallet.confirm({ wallet: { balance: result.balance } });
      if (result.coatId) coats.confirm({ coats: [...new Set([...(coats.data?.coats ?? []), result.coatId])] });
      if (result.inventoryInstanceId && command.variantId) {
        try { await apiRequest<InventoryInstanceResponse>(`/api/economy/inventory/${result.inventoryInstanceId}/variant`, { method: 'PATCH', body: JSON.stringify({ variantId: command.variantId }) }); }
        catch { setFailure('Purchased, but the finish couldn’t be applied. Change it in Inventory.'); }
      }
      setMessage(result.coatId ? 'Coat purchased. You can equip it now.' : 'Purchased. Your item is ready in Inventory.');
      await Promise.allSettled([inventory.reload(), coats.reload(), wallet.reload()]);
    } catch (error) {
      const definitive = error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
      if (definitive) {
        remember(null);
        setFailure(error.message);
        await Promise.allSettled([wallet.reload(), coats.reload(), inventory.reload()]);
      } else if (!confirmed) setFailure('The purchase couldn’t be confirmed. Retry this same purchase to check its result safely.');
    } finally { mutation.current = false; setBusy(false); }
  }
  async function equip(coat: CatAppearanceKey) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setFailure(''); setMessage('');
    try { await updateCompanion(coat, user!.catName); setMessage('Coat equipped.'); }
    catch (error) { setFailure(error instanceof Error ? error.message : 'Could not equip this coat.'); }
    finally { mutation.current = false; setBusy(false); }
  }
  async function recolor(instanceId: number, variantId: string) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setFailure(''); setMessage('');
    try {
      const { instance } = await apiRequest<InventoryInstanceResponse>(`/api/economy/inventory/${instanceId}/variant`, { method: 'PATCH', body: JSON.stringify({ variantId }) });
      inventory.confirm({ inventory: inventory.data!.inventory.map(i => i.instanceId === instance.instanceId ? instance : i) });
      if (room.data) room.confirm({ placements: room.data.placements.map(p => p.inventoryInstanceId === instance.instanceId ? { ...p, selectedVariantId: instance.selectedVariantId } : p) });
      setMessage('Finish updated.');
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Could not change the finish.'); }
    finally { mutation.current = false; setBusy(false); }
  }
  async function grant() {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setFailure('');
    grantRequest.current ??= crypto.randomUUID();
    try {
      const result = await apiRequest<{ grant: { balance: number } }>('/api/dev/coins/grants', { method: 'POST', body: JSON.stringify({ amount: 10, requestId: grantRequest.current }) });
      grantRequest.current = null; wallet.confirm({ wallet: { balance: result.grant.balance } });
      await wallet.reload(); setMessage('10 test coins added.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) { setGrantUnavailable(true); grantRequest.current = null; }
      else setFailure('Test grant couldn’t be confirmed. Retry with the same request.');
    } finally { mutation.current = false; setBusy(false); }
  }
  const close = useCallback(() => { if (!savingRef.current) navigate('/app'); }, [navigate]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey);
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-store-trigger]')?.focus());
    };
  }, [close]);
  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="store-title">
      <header className={styles.header}><div><h1 id="store-title">Store</h1><p>Make room for your favorites.</p></div>
        <div className={styles.wallet} aria-label="Coin balance"><span className={styles.coin} aria-hidden="true">●</span>{wallet.loading ? 'Loading…' : wallet.data ? `${wallet.data.wallet.balance} coins` : 'Unavailable'}</div>
        <button ref={closeButton} className={styles.close} type="button" aria-label="Close Store" disabled={savingRoom} onClick={close}>×</button>
      </header>
      <nav className={styles.tabs} aria-label="Store views">{(['shop', 'inventory', 'build'] as const).map(tab => <button type="button" key={tab} disabled={savingRoom} aria-pressed={tab === view} onClick={() => requestView(tab)}>{tab === 'build' ? 'Build' : tab === 'shop' ? 'Shop' : 'Inventory'}</button>)}</nav>
      <div ref={scroll} className={styles.scroll}>
        {message && <p className={styles.notice} role="status">{message}</p>}
        {failure && <p className={styles.error} role="alert">{failure}</p>}
        {pending && <p className={styles.notice}>A purchase is waiting for confirmation. <button className={styles.secondary} type="button" disabled={busy} onClick={() => void purchase(pending.productId)}>Retry purchase</button></p>}
        {view === 'shop' && catalog.data?.devCoinGrantsEnabled && (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') && !grantUnavailable && <p className={styles.row}><span className={styles.muted}>Development only</span><button className={styles.secondary} type="button" disabled={busy} onClick={() => void grant()}>+10 test coins</button></p>}
        {wallet.error && <p role="alert">Wallet: {wallet.error} <button type="button" onClick={() => void wallet.reload()}>Retry wallet</button></p>}
        {catalog.loading && <p role="status">Loading the Shop…</p>}
        {catalog.error && <p role="alert">Shop: {catalog.error} <button type="button" onClick={() => void catalog.reload()}>Retry Shop</button></p>}
        {inventory.loading && <p role="status">Loading inventory…</p>}
        {inventory.error && <p role="alert">Inventory: {inventory.error} <button type="button" onClick={() => void inventory.reload()}>Retry inventory</button></p>}
        {coats.error && <p role="alert">Coats: {coats.error} <button type="button" onClick={() => void coats.reload()}>Retry coats</button></p>}
        {coats.loading && <p role="status">Loading coats…</p>}
        {view === 'shop' && catalog.data && <Shop products={catalog.data.products} balance={wallet.data?.wallet.balance} inventory={inventory.data?.inventory} coats={coats.data?.coats} equipped={user!.catAppearance}
          busy={busy} pending={Boolean(pending)} buy={(id, variant) => void purchase(id, variant)} equip={coat => void equip(coat)} />}
        {view === 'inventory' && inventory.data && coats.data && <Inventory inventory={inventory.data.inventory} coats={coats.data.coats} equipped={user!.catAppearance} placements={room.data?.placements} busy={busy}
          recolor={(id, variant) => void recolor(id, variant)} equip={coat => void equip(coat)} shop={() => setView('shop')} build={id => { setBuildSelection(id); setView('build'); }} />}
        {view === 'build' && <>
          {room.loading && <p role="status">Loading your saved room…</p>}
          {room.error && <p role="alert">The saved room couldn’t load. <button className={styles.secondary} type="button" onClick={() => void room.reload()}>Retry saved room</button></p>}
          {!room.loading && !room.error && room.data && inventory.data && <GameBoundary><BuildMode inventory={inventory.data.inventory} initialSelection={buildSelection}
            onDirty={setDirty} onSaving={setSavingRoom} onSaved={() => setMessage('Room saved. Your arrangement is ready on Home.')}
            onCancel={() => requestView('inventory')} shop={() => requestView('shop')} /></GameBoundary>}
        </>}
      </div>
    </section>
    {leaving && <ConfirmDialog title="Discard room changes?" body="Your saved arrangement will stay as it was. These unsaved edits will be discarded."
      cancelLabel="Keep editing" confirmLabel="Discard changes" busy={savingRoom} busyLabel="Waiting for save…"
      onCancel={() => { setLeaveAction(null); if (blocker.state === 'blocked') blocker.reset(); }}
      onConfirm={() => {
        setDirty(false);
        if (blocker.state === 'blocked') blocker.proceed();
        else leaveAction?.();
        setLeaveAction(null);
      }} />}
  </div>;
}
