import styles from './CheckInPage.module.css';

const levels = ['A little', 'Medium', 'A lot'] as const;

export function FactorIntensityControl({ factorName, selected, onChange }: { factorName: string; selected: number | null; onChange(value: number | null): void }) {
  return <div className={styles.intensityControl!} aria-label={`${factorName} intensity`}>
    {levels.map((label, index) => {
      const value = index + 1;
      return <button type="button" key={label} aria-label={`${factorName}: ${label}`} aria-pressed={selected === value} className={selected === value ? styles.selected : ''} onClick={() => onChange(selected === value ? null : value)}>
        <span className={styles.meter!} aria-hidden="true">{Array.from({ length: 3 }, (_, bar) => <span key={bar} className={bar < value ? styles.meterOn : undefined} />)}</span>
        <span>{label}</span>
      </button>;
    })}
  </div>;
}
