import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { floorDecoration, floorFootprintCells, floorScenePoint, snapFloorNode, MAX_FLOOR_PLACEMENTS, type DecorationInventoryInstance, type FloorLayoutResponse, type PixelPoint } from '@capstone/shared';
import { apiRequest } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { useRoom } from '../room/roomContext';
import { RoomScene } from '../room/RoomScene';
import { CatSprite } from '../home/CatSprite';
import { ProductPreview } from './ProductPreview';
import { buildPlacementIssue, candidatePlacement, placementInputs, sameLayout } from './buildModel';
import { inventoryPresentation } from './inventoryPresentation';
import styles from './BuildMode.module.css';
import storeStyles from './Store.module.css';

export function BuildMode({ inventory, initialSelection, onDirty, onSaving, onSaved, onCancel, shop }: {
  inventory: DecorationInventoryInstance[]; initialSelection: number | undefined;
  onDirty(dirty: boolean): void; onSaving(saving: boolean): void; onSaved(): void; onCancel(): void; shop(): void;
}) {
  const room = useRoom();
  const { user } = useAuth();
  const [original, setOriginal] = useState(() => room.data!.placements);
  const [draft, setDraft] = useState(() => room.data!.placements);
  const [selected, setSelected] = useState<number | null>(initialSelection ?? null);
  const [node, setNode] = useState<PixelPoint>(() => {
    const placed = room.data!.placements.find(p => p.inventoryInstanceId === initialSelection);
    return placed ? [placed.gridU, placed.gridV] : [8, 8];
  });
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const precisionId = useId();
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const dirty = !sameLayout(draft, original);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const instance = inventory.find(i => i.instanceId === selected);
  const product = instance && floorDecoration(instance.productId);
  const candidate = instance && candidatePlacement(instance, node[0], node[1]);
  const issue = candidate ? buildPlacementIssue(candidate, draft) : null;
  const placed = draft.some(p => p.inventoryInstanceId === selected);
  const items = inventoryPresentation(inventory);
  const presentation = items.find(item => item.instance.instanceId === selected);
  const selectionLabels = new Map(items.map(item => [item.instance.instanceId, item.label]));

  function select(id: number) {
    if (saving) return;
    if (id !== selected) setPrecisionOpen(false);
    setSelected(id); setError(''); setFeedback('');
    const position = draft.find(p => p.inventoryInstanceId === id);
    setNode(position ? [position.gridU, position.gridV] : [8, 8]);
  }
  function apply(position: PixelPoint) {
    if (!instance || saving) return;
    setNode(position);
    const next = candidatePlacement(instance, position[0], position[1]);
    const invalid = buildPlacementIssue(next, draft);
    if (invalid) { setError(''); setFeedback(''); return; }
    setDraft(old => [...old.filter(p => p.inventoryInstanceId !== instance.instanceId), next]); setError('');
    setFeedback(`${presentation?.label} ${placed ? 'moved' : 'placed'}. Save room to keep this change.`);
  }
  function pointerNode(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapFloorNode([(event.clientX - rect.left) / rect.width * 512, (event.clientY - rect.top) / rect.height * 512]);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!instance || saving) return;
    const delta = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key];
    if (delta) { event.preventDefault(); setNode([node[0] + delta[0]!, node[1] + delta[1]!]); setError(''); }
    if (event.key === 'Enter') { event.preventDefault(); apply(node); }
  }
  async function save() {
    if (saveLock.current || !dirty) return;
    saveLock.current = true; setSaving(true); onSaving(true); setError('');
    try {
      const result = await apiRequest<FloorLayoutResponse>('/api/room/floor-layout', { method: 'PUT', body: JSON.stringify({ placements: placementInputs(draft) }) });
      room.confirm(result); setOriginal(result.placements); setDraft(result.placements); onDirty(false); onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the room. Your draft is still here.');
    } finally { saveLock.current = false; setSaving(false); onSaving(false); }
  }
  const cells = candidate && product ? floorFootprintCells(candidate.gridU, candidate.gridV, product.floor) : [];
  return <>
    <div className={storeStyles.intro}><div><h2>Build your room</h2><p>Select an item, then click a spot in the room.</p></div><span className={storeStyles.muted}>{draft.length} / {MAX_FLOOR_PLACEMENTS} placed · {dirty ? 'Unsaved changes' : 'Saved arrangement'}</span></div>
    <div className={styles.editor}>
      <div className={styles.roomColumn}>
        <RoomScene placements={draft} selectedId={selected} onSelect={select} selectionLabels={selectionLabels} cat={<CatSprite appearance={user!.catAppearance} />} testId="build-room-scene">
          <svg className={styles.floorOverlay} viewBox="0 0 512 512" aria-hidden="true"
            onPointerMove={e => { if (instance && !saving) setNode(pointerNode(e)); }} onPointerDown={e => { if (e.button === 0) apply(pointerNode(e)); }}>
            <polygon className={styles.floorTarget} points={points([floorScenePoint(0, 0), floorScenePoint(16, 0), floorScenePoint(16, 16), floorScenePoint(0, 16)])} />
            {instance && precisionOpen && Array.from({ length: 17 }, (_, i) => <g key={i} className={styles.grid}><line x1={floorScenePoint(i, 0)[0]} y1={floorScenePoint(i, 0)[1]} x2={floorScenePoint(i, 16)[0]} y2={floorScenePoint(i, 16)[1]} /><line x1={floorScenePoint(0, i)[0]} y1={floorScenePoint(0, i)[1]} x2={floorScenePoint(16, i)[0]} y2={floorScenePoint(16, i)[1]} /></g>)}
            {cells.map(([u, v]) => <polygon key={`${u}:${v}`} className={issue ? styles.invalid : styles.valid}
              points={points([floorScenePoint(u, v), floorScenePoint(u + 1, v), floorScenePoint(u + 1, v + 1), floorScenePoint(u, v + 1)])} />)}
            {candidate && <circle cx={floorScenePoint(node[0], node[1])[0]} cy={floorScenePoint(node[0], node[1])[1]} r="4" className={issue ? styles.invalid : styles.valid} />}
          </svg>
        </RoomScene>

      </div>
      <aside className={styles.rail} aria-label="Build inventory">
        <div className={styles.placement}>
          {instance ? <>
            <div className={styles.selectedItem}><span className={styles.selectedArt}><ProductPreview key={instance.selectedVariantId} productId={instance.productId} variantId={instance.selectedVariantId} /></span><div><strong>{presentation?.label}</strong><small>{presentation?.finish} · {placed ? 'In room' : 'Ready to place'}</small></div></div>
            <p className={styles.instruction}>{placed ? 'Click another spot to move this item.' : 'Click a spot in the room to place this item.'}</p>
            <p className={issue ? storeStyles.error : storeStyles.muted} role="status">{issue?.message ?? (feedback || 'Clear spot.')}</p>
            {placed && <button className={storeStyles.secondary} type="button" disabled={saving} onClick={() => { setDraft(old => old.filter(p => p.inventoryInstanceId !== selected)); setError(''); setFeedback(`${presentation?.label} removed from the room. You still own it.`); }}>Remove from room</button>}
            <button className={styles.disclosure} type="button" aria-expanded={precisionOpen} aria-controls={precisionId} onClick={() => setPrecisionOpen(open => !open)}>Adjust position<span aria-hidden="true">{precisionOpen ? '▴' : '▾'}</span></button>
            {precisionOpen && <div id={precisionId} className={styles.positionControls}><label>Floor U<input aria-label="Floor U" type="number" min="0" max="16" value={node[0]} disabled={saving} onChange={e => setNode([Number(e.target.value), node[1]])} /></label><label>Floor V<input aria-label="Floor V" type="number" min="0" max="16" value={node[1]} disabled={saving} onChange={e => setNode([node[0], Number(e.target.value)])} /></label>
              <button className={storeStyles.primary} type="button" disabled={saving || Boolean(issue)} onClick={() => apply(node)}>{placed ? 'Move here' : 'Place here'}</button></div>}
            <div className={styles.keyboard} tabIndex={0} role="group" aria-label="Keyboard placement" onKeyDown={keyboard}>Arrow keys choose a position. Enter places or moves.</div>
          </> : <p className={storeStyles.muted}>Choose an item from your collection to place or move it.</p>}
        </div>
        <h3>Your decorations</h3><p className={storeStyles.muted}>Select small props here, too.</p>
        {!inventory.length && <div><p>No decorations yet.</p><button className={storeStyles.secondary} type="button" onClick={shop}>Browse Shop</button></div>}
        {!!inventory.length && inventory.every(i => draft.some(p => p.inventoryInstanceId === i.instanceId)) && <p className={storeStyles.muted}>All your items are placed. Select one to move or remove.</p>}
        <div className={styles.itemList}>{items.map(({ instance: i, product: definition, label, finish }) => {
          const position = draft.find(p => p.inventoryInstanceId === i.instanceId);
          return <button className={styles.item} type="button" key={i.instanceId} disabled={saving || !definition} aria-label={`${label}, ${finish}, ${position ? 'In room' : 'Not placed'}`} aria-pressed={selected === i.instanceId} onClick={() => select(i.instanceId)}>
            <span className={styles.thumbnail}><ProductPreview key={i.selectedVariantId} productId={i.productId} variantId={i.selectedVariantId} /></span>
            <span><strong>{label}</strong><small>{finish} · {position ? 'In room' : 'Not placed'}{selected === i.instanceId ? ' · Selected' : ''}</small></span>
          </button>;
        })}</div>
      </aside>
    </div>
    {error && <p className={storeStyles.error} role="alert">{error}</p>}
    <footer className={styles.actions}><span className={storeStyles.muted}>Changes stay here until you save.</span><button className={storeStyles.secondary} type="button" disabled={saving} onClick={onCancel}>{dirty ? 'Discard changes' : 'Back to Inventory'}</button><button className={storeStyles.primary} type="button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save room'}</button></footer>
  </>;
}
function points(values: PixelPoint[]) { return values.map(p => p.join(',')).join(' '); }
