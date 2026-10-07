import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { InsightsPage } from './InsightsPage';
import styles from './InsightsModal.module.css';

export function InsightsModal() {
  const navigate = useNavigate();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        if (!document.querySelector('[role="dialog"][aria-labelledby="insights-title"]')) {
          document.querySelector<HTMLElement>('[data-insights-trigger]')?.focus();
        }
      });
    };
  }, [close]);

  return (
    <div className={styles.backdrop!} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className={styles.dialog!} role="dialog" aria-modal="true" aria-labelledby="insights-title">
        <header className={styles.modalHeader!}>
          <div>
            <h1 id="insights-title">Insights</h1>
            <p>See patterns in the information you’ve tracked over time.</p>
          </div>
          <button ref={closeButton} className={styles.close!} type="button" aria-label="Close Insights" onClick={close}>×</button>
        </header>
        <div className={styles.insightsScroll!}>
          <InsightsPage />
        </div>
      </section>
    </div>
  );
}
