import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DEFAULT_CAT_APPEARANCE, type CatAppearanceKey } from '@capstone/shared';
import { useAuth } from '../auth/useAuth';
import { CatAppearancePicker } from '../features/auth/CatAppearancePicker';
import styles from './AppShell.module.css';

export function AppShell() {
  const { user, logout, updateCompanion } = useAuth();
  const navigate = useNavigate();
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [appearance, setAppearance] = useState<CatAppearanceKey>(user?.catAppearance ?? DEFAULT_CAT_APPEARANCE);
  const [catName, setCatName] = useState(user?.catName ?? 'Mochi');
  const [savingCompanion, setSavingCompanion] = useState(false);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    if (!accountOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAccountOpen(false);
      accountTrigger.current?.focus();
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (!accountMenu.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [accountOpen]);

  function toggleAccount() {
    if (!accountOpen) {
      setAppearance(user?.catAppearance ?? DEFAULT_CAT_APPEARANCE);
      setCatName(user?.catName ?? 'Mochi');
      setAccountError('');
    }
    setAccountOpen((open) => !open);
  }

  async function saveCompanion(event: FormEvent) {
    event.preventDefault();
    const trimmedName = catName.trim();
    if (!trimmedName) { setAccountError('Give your companion a name.'); return; }
    setSavingCompanion(true);
    setAccountError('');
    try {
      await updateCompanion(appearance, trimmedName);
      setAccountOpen(false);
      accountTrigger.current?.focus();
    } catch (error: unknown) {
      setAccountError(error instanceof Error ? error.message : 'Could not update your companion.');
    } finally {
      setSavingCompanion(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink className={styles.brand!} to="/app">Pawprint</NavLink>
        <div className={styles.account!}>
          <div ref={accountMenu} className={styles.accountMenu!}>
            <button ref={accountTrigger} className={styles.accountTrigger!} type="button" aria-haspopup="dialog" aria-expanded={accountOpen} aria-controls="account-settings" onClick={toggleAccount}>
              <span>{user?.username}</span><span aria-hidden="true">▾</span>
            </button>
            {accountOpen && <section id="account-settings" className={styles.accountPanel!} role="dialog" aria-labelledby="account-title">
              <div className={styles.panelHeader!}><h2 id="account-title">Account</h2><button className={styles.closePanel!} type="button" aria-label="Close account settings" onClick={() => { setAccountOpen(false); accountTrigger.current?.focus(); }}>×</button></div>
              <form onSubmit={saveCompanion}>
                <label className={styles.catNameField!}>Cat name<input value={catName} onChange={(event) => { setCatName(event.target.value); setAccountError(''); }} maxLength={40} required /></label>
                <CatAppearancePicker legend="Cat appearance" value={appearance} onChange={setAppearance} />
                {accountError && <p className={styles.accountError!} role="alert">{accountError}</p>}
                <button className={styles.saveCompanion!} type="submit" disabled={savingCompanion}>{savingCompanion ? 'Saving…' : 'Save'}</button>
              </form>
            </section>}
          </div>
          <button className={styles.logoutButton!} type="button" onClick={() => void logout().then(() => navigate('/login'))}>Log out</button>
        </div>
      </header>
      <main className={styles.main!}>
        <Outlet />
      </main>
    </div>
  );
}
