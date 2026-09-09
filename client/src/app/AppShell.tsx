import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

const links = [
  ['Home', '/app'],
  ['Tracking', '/app/tracking'],
  ['History', '/app/history'],
  ['Insights', '/app/insights'],
] as const;

export function AppShell() {
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
      </header>
      <main className={styles.main!}>
        <Outlet />
      </main>
    </div>
  );
}
