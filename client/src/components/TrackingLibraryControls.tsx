import type { ReactNode } from 'react';
import styles from './TrackingLibraryControls.module.css';

export function TrackingChoiceGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid!}>{children}</div>;
}

export function TrackingChoiceChip({ name, selected, disabled = false, onToggle, onDelete, deleteLabel }: {
  name: string;
  selected: boolean;
  disabled?: boolean;
  onToggle(): void;
  onDelete?(): void;
  deleteLabel?: string;
}) {
  return <div className={`${styles.chipShell!} ${onDelete ? styles.deletable! : ''}`}>
    <label className={`${styles.chip!} ${selected ? styles.selected! : ''}`}>
      <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} />
      <span className={styles.mark!} aria-hidden="true">{selected ? '✓' : '+'}</span>
      <span className={styles.name!}>{name}</span>
    </label>
    {onDelete && <button className={styles.delete!} type="button" disabled={disabled} onClick={onDelete} aria-label={deleteLabel ?? `Delete ${name}`}>Delete</button>}
  </div>;
}

export function TrackingCategoryList({ children }: { children: ReactNode }) {
  return <div className={styles.categories!}>{children}</div>;
}

export function TrackingCategoryAccordion({ id, label, expanded, onToggle, children }: {
  id: string;
  label: string;
  expanded: boolean;
  onToggle(): void;
  children: ReactNode;
}) {
  return <section className={styles.accordion!}>
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={onToggle}>
      <span>{label}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
    </button>
    {expanded && <div id={id} className={styles.panel!}>{children}</div>}
  </section>;
}
