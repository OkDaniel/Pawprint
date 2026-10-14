import { useEffect, useRef } from 'react';
import styles from './CheckInPage.module.css';

export function ConfirmDialog({ title, body, cancelLabel, confirmLabel, busy = false, busyLabel = 'Deleting…', onCancel, onConfirm, fallbackFocus }: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
  onCancel(): void;
  onConfirm(): void;
  fallbackFocus?(): void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const cancelAction = useRef(onCancel);
  const isBusy = useRef(busy);
  const fallbackAction = useRef(fallbackFocus);
  const restoreFrame = useRef<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  cancelAction.current = onCancel;
  isBusy.current = busy;
  fallbackAction.current = fallbackFocus;

  useEffect(() => {
    // StrictMode repeats setup after cleanup; cancel that obsolete restoration.
    if (restoreFrame.current !== null) window.cancelAnimationFrame(restoreFrame.current);
    if (!returnFocus.current) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      restoreFrame.current = window.requestAnimationFrame(() => {
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
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
        <button className={styles.destructive!} type="button" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
