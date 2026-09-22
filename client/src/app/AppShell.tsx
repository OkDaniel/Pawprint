import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import styles from './AppShell.module.css';

const links = [
  ['Home', '/app'],
  ['Insights', '/app/insights'],
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink className={styles.brand!} to="/app">Pawprint</NavLink>
        <nav aria-label="Primary navigation" className={styles.navigation!}>
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} end={path === '/app'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account!}><span>{user?.username}</span><button type="button" onClick={() => void logout().then(() => navigate('/login'))}>Log out</button></div>
      </header>
      <main className={styles.main!}>
        <Outlet />
      </main>
    </div>
  );
}
