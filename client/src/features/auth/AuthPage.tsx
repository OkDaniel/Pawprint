import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import styles from './AuthPage.module.css';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      await (mode === 'login' ? login(username, password) : register(username, password));
      navigate('/app', { replace: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The request failed.'); }
    finally { setSubmitting(false); }
  }

  const registering = mode === 'register';
  return <main className={styles.page!}><section className={styles.card!}>
    <h1>{registering ? 'Create your Pawprint account' : 'Welcome back'}</h1>
    <form className={styles.form!} onSubmit={submit}>
      <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required autoComplete="username" /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete={registering ? 'new-password' : 'current-password'} /></label>
      {error && <p className={styles.error!} role="alert">{error}</p>}
      <button disabled={submitting}>{submitting ? 'Please wait…' : registering ? 'Register' : 'Log in'}</button>
    </form>
    <p className={styles.switch!}>{registering ? 'Already registered?' : 'New to Pawprint?'}{' '}
      <Link to={registering ? '/login' : '/register'}>{registering ? 'Log in' : 'Create an account'}</Link>
    </p>
  </section></main>;
}
