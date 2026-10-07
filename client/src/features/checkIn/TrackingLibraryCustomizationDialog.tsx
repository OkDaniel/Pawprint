import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  factorCategories,
  symptomCategories,
  type Factor,
  type FactorCategory,
  type FactorListResponse,
  type Symptom,
  type SymptomCategory,
  type SymptomListResponse,
} from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { ConfirmDialog } from './ConfirmDialog';
import { duplicateCustomItemMessage, findCustomItemDuplicate } from './customItemValidation';
import styles from './TrackingLibraryCustomizationDialog.module.css';

type LibraryItem = Symptom | Factor;
type LibraryCategory = SymptomCategory | FactorCategory;
type Props = (
  | { kind: 'symptoms'; items: Symptom[]; onChange(items: Symptom[]): void }
  | { kind: 'factors'; items: Factor[]; onChange(items: Factor[]): void }
) & { onClose(): void };

type ViewProps = Props & { stepTitle: string };

export function TrackingLibraryCustomizationDialog(props: ViewProps) {
  const categories: readonly LibraryCategory[] = props.kind === 'symptoms' ? symptomCategories : factorCategories;
  const [items, setItems] = useState<LibraryItem[]>(props.items);
  const itemsRef = useRef<LibraryItem[]>(props.items);
  const [draftName, setDraftName] = useState('');
  const draftNameRef = useRef('');
  const [selectedCategory, setSelectedCategory] = useState<LibraryCategory>(categories[0]!);
  const [errors, setErrors] = useState<Partial<Record<LibraryCategory, string>>>({});
  const [creatorError, setCreatorError] = useState('');
  const [busyCategory, setBusyCategory] = useState<LibraryCategory | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<LibraryItem | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const closeAction = useRef<() => Promise<void>>(async () => undefined);
  const pendingRemovalRef = useRef<LibraryItem | null>(null);
  const busyRef = useRef<LibraryCategory | null>(null);
  const noun = props.kind === 'symptoms' ? 'symptom' : 'factor';
  const title = `Customize ${props.kind}`;
  const titleId = `${props.kind}-customization-title`;
  const descriptionId = `${props.kind}-customization-description`;

  pendingRemovalRef.current = pendingRemoval;
  busyRef.current = busyCategory;

  useEffect(() => {
    itemsRef.current = props.items;
    setItems(props.items);
  }, [props.items]);

  useEffect(() => {
    heading.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (pendingRemovalRef.current) return;
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        void closeAction.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function publish(next: LibraryItem[]) {
    itemsRef.current = next;
    setItems(next);
    if (props.kind === 'symptoms') props.onChange(next as Symptom[]);
    else props.onChange(next as Factor[]);
  }

  function updateDraft(value: string) {
    draftNameRef.current = value;
    setDraftName(value);
    setCreatorError('');
  }

  function mergeCategory(current: LibraryItem[], category: LibraryCategory, updated: LibraryItem[]): LibraryItem[] {
    return [...current.filter((item) => item.category !== category), ...updated];
  }

  async function persistSelection(item: LibraryItem) {
    if (busyCategory) return;
    const category = item.category;
    const before = itemsRef.current;
    const optimistic = before.map((candidate) => candidate.id === item.id ? { ...candidate, isPinned: !candidate.isPinned } : candidate);
    publish(optimistic);
    setBusyCategory(category);
    setErrors((current) => ({ ...current, [category]: '' }));
    try {
      if (props.kind === 'symptoms') {
        const ids = optimistic.filter((candidate) => candidate.category === category && candidate.isPinned).map(({ id }) => id);
        const response = await apiRequest<SymptomListResponse>('/api/symptoms/preferences', { method: 'PUT', body: JSON.stringify({ category, ids }) });
        publish(mergeCategory(itemsRef.current, category, response.symptoms));
      } else {
        const ids = optimistic.filter(({ isPinned }) => isPinned).map(({ id }) => id);
        const response = await apiRequest<FactorListResponse>('/api/factors/preferences', { method: 'PUT', body: JSON.stringify({ ids }) });
        publish(response.factors);
      }
    } catch (caught) {
      publish(before);
      setErrors((current) => ({ ...current, [category]: caught instanceof Error ? caught.message : `Could not update this ${noun}.` }));
    } finally {
      setBusyCategory(null);
    }
  }

  async function createItem(category: LibraryCategory, suppliedName?: string): Promise<boolean> {
    const name = (suppliedName ?? draftNameRef.current).trim();
    if (!name) return true;
    const duplicate = findCustomItemDuplicate(itemsRef.current, name);
    if (duplicate) {
      setCreatorError(duplicateCustomItemMessage(duplicate));
      window.requestAnimationFrame(() => nameInput.current?.focus());
      return false;
    }
    setBusyCategory(category);
    setCreatorError('');
    try {
      if (props.kind === 'symptoms') {
        const createdResponse = await apiRequest<SymptomListResponse>('/api/symptoms', { method: 'POST', body: JSON.stringify({ name, category }) });
        const created = createdResponse.symptoms.find((item) => !item.isBuiltin && item.category === category && item.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0);
        if (!created) throw new Error('The custom symptom was created but could not be selected.');
        const ids = new Set(createdResponse.symptoms.filter(({ isPinned }) => isPinned).map(({ id }) => id));
        ids.add(created.id);
        const preferenceResponse = await apiRequest<SymptomListResponse>('/api/symptoms/preferences', { method: 'PUT', body: JSON.stringify({ category, ids: [...ids] }) });
        publish(mergeCategory(itemsRef.current, category, preferenceResponse.symptoms));
      } else {
        const createdResponse = await apiRequest<FactorListResponse>('/api/factors', { method: 'POST', body: JSON.stringify({ name, category }) });
        const created = createdResponse.factors.find((item) => !item.isBuiltin && item.category === category && item.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0);
        if (!created) throw new Error('The custom factor was created but could not be selected.');
        const ids = new Set(createdResponse.factors.filter(({ isPinned }) => isPinned).map(({ id }) => id));
        ids.add(created.id);
        const preferenceResponse = await apiRequest<FactorListResponse>('/api/factors/preferences', { method: 'PUT', body: JSON.stringify({ ids: [...ids] }) });
        publish(preferenceResponse.factors);
      }
      updateDraft('');
      return true;
    } catch (caught) {
      setCreatorError(caught instanceof Error ? caught.message : `Could not create this ${noun}.`);
      window.requestAnimationFrame(() => nameInput.current?.focus());
      return false;
    } finally {
      setBusyCategory(null);
    }
  }

  async function requestClose() {
    if (busyRef.current) return;
    if (draftNameRef.current.trim() && !await createItem(selectedCategory)) return;
    props.onClose();
  }
  closeAction.current = requestClose;

  async function removeConfirmed() {
    if (!pendingRemoval) return;
    const item = pendingRemoval;
    setBusyCategory(item.category);
    setErrors((current) => ({ ...current, [item.category]: '' }));
    try {
      if (props.kind === 'symptoms') {
        const response = await apiRequest<SymptomListResponse>(`/api/symptoms/${item.id}?category=${encodeURIComponent(item.category)}`, { method: 'DELETE' });
        publish(mergeCategory(itemsRef.current, item.category, response.symptoms));
      } else {
        const response = await apiRequest<FactorListResponse>(`/api/factors/${item.id}`, { method: 'DELETE' });
        publish(response.factors);
      }
      setPendingRemoval(null);
      window.requestAnimationFrame(() => backButton.current?.focus());
    } catch (caught) {
      setErrors((current) => ({ ...current, [item.category]: caught instanceof Error ? caught.message : `Could not delete this ${noun}.` }));
    } finally {
      setBusyCategory(null);
    }
  }

  return <>
    <div className={styles.view!} aria-hidden={pendingRemoval ? true : undefined}>
      <header className={styles.header!}>
        <button ref={backButton} className={styles.back!} type="button" disabled={Boolean(busyCategory)} onClick={() => void requestClose()} aria-label={`Back to ${props.stepTitle}`}>← {props.stepTitle}</button>
        <div><h1 ref={heading} tabIndex={-1} id={titleId}>{title}</h1><p id={descriptionId}>Choose which {props.kind} appear when you check in.</p></div>
      </header>
      <div className={styles.body!} role="region" aria-label={props.kind === 'symptoms' ? 'Symptom choices' : 'Factor choices'}>
        <div className={styles.groups!}>{categories.map((category) => {
          const categoryItems = items.filter((item) => item.category === category);
          const headingId = `${props.kind}-category-${toId(category)}`;
          return <section key={category} className={styles.group!} aria-labelledby={headingId}>
            <h3 id={headingId}>{category}</h3>
            {categoryItems.length > 0
              ? <div className={styles.itemList!}>{categoryItems.map((item) => <div className={`${styles.item!} ${item.isPinned ? styles.itemSelected! : ''}`} key={item.id}>
                <label><input type="checkbox" checked={item.isPinned} disabled={Boolean(busyCategory)} onChange={() => void persistSelection(item)} /><span>{item.name}</span></label>
                {!item.isBuiltin && <><small>Custom</small><button className={styles.itemDelete!} type="button" disabled={Boolean(busyCategory)} onClick={() => setPendingRemoval(item)} aria-label={`Delete ${item.name}`}>Delete</button></>}
              </div>)}</div>
              : <p className={styles.empty!}>No {props.kind} are available in this category yet.</p>}
            {errors[category] && <p className={styles.error!} role="alert">{errors[category]}</p>}
          </section>;
        })}</div>
      </div>
      <section className={styles.creator!} aria-label="Add your own">
        <form className={styles.addForm!} onSubmit={(event: FormEvent) => { event.preventDefault(); void createItem(selectedCategory); }}>
          <label>Add your own<input ref={nameInput} aria-label={props.kind === 'symptoms' ? 'Symptom name' : 'Factor name'} aria-invalid={Boolean(creatorError)} aria-describedby={creatorError ? `${props.kind}-creator-error` : undefined} value={draftName} onChange={(event) => updateDraft(event.target.value)} maxLength={120} placeholder={props.kind === 'symptoms' ? 'Symptom name' : 'Factor name'} /></label>
          <label>Category<select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value as LibraryCategory); setCreatorError(''); }}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <button type="submit" disabled={Boolean(busyCategory) || !draftName.trim()}>{busyCategory === selectedCategory ? 'Adding…' : 'Add'}</button>
        </form>
        {creatorError && <p id={`${props.kind}-creator-error`} className={styles.error!} role="alert">{creatorError}</p>}
      </section>
      <footer className={styles.footer!}><button className={styles.done!} type="button" disabled={Boolean(busyCategory)} onClick={() => void requestClose()}>Done</button></footer>
    </div>
    {pendingRemoval && <ConfirmDialog
      title={`Delete ${pendingRemoval.name}?`}
      body={`This removes it from your tracked ${props.kind}. Past Check-Ins will remain available.`}
      cancelLabel={`Keep ${noun}`}
      confirmLabel={`Delete ${noun[0]!.toLocaleUpperCase()}${noun.slice(1)}`}
      busy={Boolean(busyCategory)}
      onCancel={() => setPendingRemoval(null)}
      onConfirm={() => void removeConfirmed()}
      fallbackFocus={() => backButton.current?.focus()}
    />}
  </>;
}

function toId(value: string): string {
  return value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '');
}
