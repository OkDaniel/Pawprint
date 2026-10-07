import { useEffect, useRef } from 'react';
import styles from './CheckInPage.module.css';

export function ConfirmDialog({ title, body, cancelLabel, confirmLabel, busy = false, onCancel, onConfirm, fallbackFocus }: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel(): void;
  onConfirm(): void;
  fallbackFocus?(): void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const cancelAction = useRef(onCancel);
  const isBusy = useRef(busy);
  const fallbackAction = useRef(fallbackFocus);
  cancelAction.current = onCancel;
  isBusy.current = busy;
  fallbackAction.current = fallbackFocus;

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButton.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy.current) {
        event.preventDefault();
        cancelAction.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
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
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
        else fallbackAction.current?.();
      });
    };
  }, []);

  return <div className={styles.confirmBackdrop!} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section ref={dialog} className={styles.confirmDialog!} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-body">{body}</p>
      <div className={styles.confirmActions!}>
        <button ref={cancelButton} className={styles.secondary!} type="button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button className={styles.destructive!} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
