import { catAppearanceKeys, type CatAppearanceKey } from '@capstone/shared';
import { CatSprite } from '../home/CatSprite';
import styles from './CatAppearancePicker.module.css';

const labels: Record<CatAppearanceKey, string> = {
  'mochi-classic': 'Classic',
  'mochi-grey': 'Grey',
  'mochi-orange': 'Orange',
  'mochi-white': 'White',
};

export function CatAppearancePicker({ legend, value, onChange }: {
  legend: string;
  value: CatAppearanceKey;
  onChange(value: CatAppearanceKey): void;
}) {
  return <fieldset className={styles.choices!}>
    <legend>{legend}</legend>
    <div>
      {catAppearanceKeys.map((key) => <label key={key} className={value === key ? styles.selected : undefined}>
        <input type="radio" name="catAppearance" value={key} checked={value === key} onChange={() => onChange(key)} />
        <CatSprite appearance={key} animation="idle" />
        <span>{labels[key]}</span>
      </label>)}
    </div>
  </fieldset>;
}
