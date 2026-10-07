import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Feeling, FeelingListResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { ConfirmDialog } from './ConfirmDialog';
import { duplicateCustomItemMessage, findCustomItemDuplicate } from './customItemValidation';
import styles from './TrackingLibraryCustomizationDialog.module.css';

export function FeelingCustomizationDialog({ stepTitle, items: initialItems, onChange, onClose }: {
  stepTitle: string;
  items: Feeling[];
  onChange(items: Feeling[]): void;
  onClose(): void;
}) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<Feeling | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const saveAction = useRef<() => Promise<void>>(async () => undefined);
  const pendingRemovalRef = useRef<Feeling | null>(null);
  const savingRef = useRef(false);
  pendingRemovalRef.current = pendingRemoval;
  savingRef.current = saving;

  useEffect(() => {
    heading.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pendingRemovalRef.current && !savingRef.current) {
        event.preventDefault();
        void saveAction.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function publish(updated: Feeling[]) {
    setItems(updated);
    onChange(updated);
  }

  async function createItem(): Promise<Feeling[]> {
    const trimmedName = name.trim();
    if (!trimmedName) return items;
    const duplicate = findCustomItemDuplicate(items, trimmedName);
    if (duplicate) {
      setError(duplicateCustomItemMessage(duplicate));
      window.requestAnimationFrame(() => nameInput.current?.focus());
      throw new DuplicateCustomItemError();
    }
    const pendingPins = new Map(items.map((item) => [item.id, item.isPinned]));
    try {
      const response = await apiRequest<FeelingListResponse>('/api/feelings', { method: 'POST', body: JSON.stringify({ name: trimmedName }) });
      const merged = response.feelings.map((item) => pendingPins.has(item.id) ? { ...item, isPinned: pendingPins.get(item.id)! } : item);
      publish(merged);
      setName('');
      return merged;
    } catch (caught) {
      window.requestAnimationFrame(() => nameInput.current?.focus());
      throw caught;
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try { await createItem(); }
    catch (caught) { if (!(caught instanceof DuplicateCustomItemError)) setError(caught instanceof Error ? caught.message : 'Could not create this item.'); }
    finally { setSaving(false); }
  }

  async function removeConfirmed() {
    if (!pendingRemoval) return;
    setSaving(true); setError('');
    try {
      const response = await apiRequest<FeelingListResponse>(`/api/feelings/${pendingRemoval.id}`, { method: 'DELETE' });
      publish(response.feelings);
      setPendingRemoval(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not remove this item.'); }
    finally { setSaving(false); }
  }

  async function save() {
    if (savingRef.current) return;
    setSaving(true); setError('');
    try {
      const itemsToSave = name.trim() ? await createItem() : items;
      const ids = itemsToSave.filter((item) => item.isPinned).map((item) => item.id);
      const response = await apiRequest<FeelingListResponse>('/api/feelings/preferences', { method: 'PUT', body: JSON.stringify({ ids }) });
      onChange(response.feelings);
      onClose();
    } catch (caught) { if (!(caught instanceof DuplicateCustomItemError)) setError(caught instanceof Error ? caught.message : 'Could not save preferences.'); }
    finally { setSaving(false); }
  }
  saveAction.current = save;

  return <>
    <div className={styles.view!} aria-hidden={pendingRemoval ? true : undefined}>
      <header className={styles.header!}>
        <button ref={backButton} className={styles.back!} type="button" disabled={saving} onClick={() => void save()} aria-label={`Back to ${stepTitle}`}>← {stepTitle}</button>
        <div><h1 ref={heading} tabIndex={-1} id="feelings-customization-title">Customize feelings</h1><p id="feeling-custom-description">Choose which feelings appear in your quick Check-In list.</p></div>
      </header>
      <div className={styles.body!} role="region" aria-label="Feeling choices">
        <div className={styles.itemList!}>{items.map((item) => <div className={`${styles.item!} ${item.isPinned ? styles.itemSelected! : ''}`} key={item.id}>
          <label><input type="checkbox" checked={item.isPinned} onChange={() => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isPinned: !candidate.isPinned } : candidate))} /><span>{item.name}</span></label>
          {!item.isBuiltin && <><small>Custom</small><button className={styles.itemDelete!} type="button" disabled={saving} onClick={() => setPendingRemoval(item)} aria-label={`Delete ${item.name}`}>Delete</button></>}
        </div>)}</div>
      </div>
      <section className={styles.creator!} aria-label="Add your own">
        <form className={`${styles.addForm!} ${styles.feelingAddForm!}`} onSubmit={create}>
          <label>Add your own<input ref={nameInput} aria-label="Feeling name" aria-invalid={Boolean(error)} aria-describedby={error ? 'feeling-creator-error' : undefined} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} maxLength={120} placeholder="Feeling name" /></label>
          <button type="submit" disabled={saving || !name.trim()}>Add</button>
        </form>
        {error && <p id="feeling-creator-error" role="alert" className={styles.error!}>{error}</p>}
      </section>
      <footer className={styles.footer!}><button ref={doneButton} className={styles.done!} type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Done'}</button></footer>
    </div>
    {pendingRemoval && <ConfirmDialog
      title={`Delete ${pendingRemoval.name}?`}
      body="This removes it from your tracked feelings. Past Check-Ins will remain available."
      cancelLabel="Keep feeling"
      confirmLabel="Delete Feeling"
      busy={saving}
      onCancel={() => setPendingRemoval(null)}
      onConfirm={() => void removeConfirmed()}
      fallbackFocus={() => { if (backButton.current) backButton.current.focus(); else doneButton.current?.focus(); }}
    />}
  </>;
}

class DuplicateCustomItemError extends Error {}
