import { useEffect, useRef, useState } from 'react';
import type { StoreCatalogResponse, WalletResponse } from '@capstone/shared';
import { ApiError, apiRequest } from '../api/api';
import { useResource } from '../features/room/useResource';
import { notifyWalletUpdated } from '../features/store/walletUpdates';
import styles from './AppShell.module.css';

export function DevelopmentCoinButton() {
  const catalog = useResource<StoreCatalogResponse>('/api/economy/catalog');
  const requestId = useRef<string | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function grant() {
    if (lock.current || !catalog.data?.devCoinGrantsEnabled || unavailable) return;
    lock.current = true; setBusy(true); setNotice(''); setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      await apiRequest('/api/dev/coins/grants', {
        method: 'POST', body: JSON.stringify({ amount: 100, requestId: requestId.current }),
      });
      // Confirmation ends this intent even if the subsequent wallet read fails.
      requestId.current = null; setRetry(false);
      try {
        notifyWalletUpdated(await apiRequest<WalletResponse>('/api/economy/wallet'));
        setNotice('100 test coins added.');
      } catch {
        notifyWalletUpdated();
        setNotice('100 test coins added. Wallet refresh unavailable; retry the wallet in Store.');
      }
    } catch (failure) {
      const definitive = failure instanceof ApiError && failure.status >= 400 && failure.status < 500 && ![408, 429].includes(failure.status);
      if (definitive) {
        requestId.current = null; setRetry(false);
        if (failure.status === 404) setUnavailable(true);
        else setError(failure.message);
      } else {
        setRetry(true); setError('Grant not confirmed. Retry to check the same request.');
      }
    } finally { lock.current = false; setBusy(false); }
  }

  if (!catalog.data?.devCoinGrantsEnabled || unavailable) return null;
  return <div className={styles.coinControl}>
    <button className={styles.coinButton} type="button" disabled={busy} onClick={() => void grant()}
      title="Development only: grant 100 test coins">
      {busy ? '🪙 Adding…' : retry ? '🪙 Retry +100 Coins' : '🪙 +100 Coins'}
    </button>
    {notice && <span className={styles.coinNotice} role="status">{notice}</span>}
    {error && <span className={styles.coinNotice} role="alert">{error}</span>}
  </div>;
}
