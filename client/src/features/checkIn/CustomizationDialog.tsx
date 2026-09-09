import { useMemo, useState, type FormEvent } from 'react';
import { factorCategories, type Factor, type FactorCategory, type FactorListResponse, type Feeling, type FeelingListResponse, type Symptom, type SymptomCategory, type SymptomListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import styles from './CheckInPage.module.css';

type Props =
  | { kind: 'feelings'; items: Feeling[]; onChange(items: Feeling[]): void; onClose(): void }
  | { kind: 'symptoms'; category: SymptomCategory; items: Symptom[]; onChange(items: Symptom[]): void; onClose(): void }
  | { kind: 'factors'; items: Factor[]; onChange(items: Factor[]): void; onClose(): void };

export function CustomizationDialog(props: Props) {
  const [items, setItems] = useState(props.items);
  const [name, setName] = useState('');
  const [factorCategory, setFactorCategory] = useState<FactorCategory>('Lifestyle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = props.kind === 'feelings' ? 'Customize feelings' : props.kind === 'symptoms' ? `Customize ${props.category}` : 'Customize factors';
  const groupedItems = useMemo(() => props.kind === 'factors'
    ? factorCategories.map((category) => ({ category, items: items.filter((item): item is Factor => 'category' in item && item.category === category) }))
    : [{ category: null, items }], [items, props.kind]);

  function toggle(id: number) { setItems((current) => current.map((item) => item.id === id ? { ...item, isPinned: !item.isPinned } : item)); }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      if (props.kind === 'feelings') setItems((await apiRequest<FeelingListResponse>('/api/feelings', { method: 'POST', body: JSON.stringify({ name }) })).feelings);
      else if (props.kind === 'symptoms') setItems((await apiRequest<SymptomListResponse>('/api/symptoms', { method: 'POST', body: JSON.stringify({ name, category: props.category }) })).symptoms);
      else setItems((await apiRequest<FactorListResponse>('/api/factors', { method: 'POST', body: JSON.stringify({ name, category: factorCategory }) })).factors);
      setName('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create this item.'); }
    finally { setSaving(false); }
  }

  async function remove(item: Feeling | Symptom | Factor) {
    if (!window.confirm(`Remove your custom item “${item.name}”? Past Check-Ins will keep it.`)) return;
    setSaving(true); setError('');
    try {
      if (props.kind === 'feelings') setItems((await apiRequest<FeelingListResponse>(`/api/feelings/${item.id}`, { method: 'DELETE' })).feelings);
      else if (props.kind === 'symptoms') setItems((await apiRequest<SymptomListResponse>(`/api/symptoms/${item.id}?category=${encodeURIComponent(props.category)}`, { method: 'DELETE' })).symptoms);
      else setItems((await apiRequest<FactorListResponse>(`/api/factors/${item.id}`, { method: 'DELETE' })).factors);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove this item.'); }
    finally { setSaving(false); }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const ids = items.filter((item) => item.isPinned).map((item) => item.id);
      if (props.kind === 'feelings') props.onChange((await apiRequest<FeelingListResponse>('/api/feelings/preferences', { method: 'PUT', body: JSON.stringify({ ids }) })).feelings);
      else if (props.kind === 'symptoms') props.onChange((await apiRequest<SymptomListResponse>('/api/symptoms/preferences', { method: 'PUT', body: JSON.stringify({ ids, category: props.category }) })).symptoms);
      else props.onChange((await apiRequest<FactorListResponse>('/api/factors/preferences', { method: 'PUT', body: JSON.stringify({ ids }) })).factors);
      props.onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save preferences.'); }
    finally { setSaving(false); }
  }

  return <div className={styles.customBackdrop!} role="presentation">
    <section className={styles.customDialog!} role="dialog" aria-modal="true" aria-labelledby="custom-title">
      <header className={styles.customHeader!}><div><h2 id="custom-title">{title}</h2><p>Choose your quick Check-In list.</p></div><button type="button" onClick={props.onClose} aria-label="Close customization">×</button></header>
      <div className={styles.customScroll!}>
        {groupedItems.map((group) => <section key={group.category ?? 'items'} className={styles.customGroup!}>{group.category && <h3>{group.category}</h3>}<div className={styles.customList!}>{group.items.map((item) => <div className={styles.customItem!} key={item.id}><label><input type="checkbox" checked={item.isPinned} onChange={() => toggle(item.id)} /><span>{item.name}</span></label>{!item.isBuiltin && <><small>Custom</small><button className={styles.removeItem!} type="button" disabled={saving} onClick={() => void remove(item)} aria-label={`Remove ${item.name}`}>Remove</button></>}</div>)}</div></section>)}
      </div>
      <form className={styles.addForm!} onSubmit={create}><label>Add your own<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder={props.kind === 'feelings' ? 'Feeling name' : props.kind === 'symptoms' ? 'Symptom name' : 'Factor name'} /></label>{props.kind === 'factors' && <label>Category<select value={factorCategory} onChange={(event) => setFactorCategory(event.target.value as FactorCategory)}>{factorCategories.map((category) => <option key={category}>{category}</option>)}</select></label>}<button type="submit" disabled={saving || !name.trim()}>Add</button></form>
      {error && <p role="alert" className={styles.error!}>{error}</p>}
      <button className={styles.primary!} type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Done'}</button>
    </section>
  </div>;
}
