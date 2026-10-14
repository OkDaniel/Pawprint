import { floorDecoration, resolveFloorVariant, type CatAppearanceKey, type DecorationInventoryInstance, type FloorPlacement } from '@capstone/shared';
import { ProductPreview } from './ProductPreview';
import { coatNames } from './storeCatalog';
import { inventoryPresentation } from './inventoryPresentation';
import styles from './Store.module.css';

export function Inventory({ inventory, coats, equipped, placements, busy, recolor, equip, build, shop }: {
  inventory: DecorationInventoryInstance[]; coats: CatAppearanceKey[]; equipped: string;
  placements: FloorPlacement[] | undefined; busy: boolean;
  recolor(instanceId: number, variantId: string): void; equip(coat: CatAppearanceKey): void; build(id?: number): void; shop(): void;
}) {
  const groups = new Map<string, ReturnType<typeof inventoryPresentation>>();
  for (const item of inventoryPresentation(inventory)) groups.set(item.instance.productId, [...(groups.get(item.instance.productId) ?? []), item]);
  return <>
    <div className={styles.intro}><div><h2>Your collection</h2><p>Change finishes for free. Each item has its own place in the room.</p></div><button className={styles.primary} type="button" onClick={() => build()}>Open Build Mode</button></div>
    {!inventory.length && <div className={styles.empty}><p>No decorations yet. Find something for your room.</p><button className={styles.secondary} type="button" onClick={shop}>Browse Shop</button></div>}
    <div className={styles.inventoryGroups}>{[...groups].map(([id, instances]) => {
      const product = floorDecoration(id);
      return <section key={id} className={styles.inventoryGroup} aria-label={product?.displayName ?? 'Decoration'}>
        <h3>{product?.displayName ?? 'Decoration'} <span className={styles.muted}>· {instances.length} owned</span></h3>
        {instances.map(({ instance, label }) => {
          const variant = product && resolveFloorVariant(product, instance.selectedVariantId);
          const placed = placements?.some(p => p.inventoryInstanceId === instance.instanceId);
          return <div className={styles.instance} key={instance.instanceId} data-instance={instance.instanceId}>
            <div className={styles.instanceArt}><ProductPreview key={instance.selectedVariantId} productId={id} variantId={instance.selectedVariantId} /></div>
            <div className={styles.instanceDetails}><strong>{label}</strong><p className={styles.muted}>{placements ? placed ? 'In room' : 'Not placed' : 'Placement unavailable'}</p></div>
            {product && <label className={styles.finish}>Finish<select aria-label={`Finish for ${label}`} value={variant?.id ?? ''} disabled={busy} onChange={e => recolor(instance.instanceId, e.target.value)}>{product.variants.map(v => <option value={v.id} key={v.id}>{v.label}</option>)}</select></label>}
            <button className={styles.secondary} type="button" disabled={busy || !product} onClick={() => build(instance.instanceId)}>{placed ? 'Move in Build' : 'Place in Build'}</button>
          </div>;
        })}
      </section>;
    })}</div>
    <h2 className={styles.collectionTitle}>Cat coats</h2><div className={styles.coatCollection}>{coats.map(coat => <div className={styles.ownedCoat} key={coat}><ProductPreview productId={coat} /><div><strong>{coatNames[coat]}</strong><p className={styles.muted}>Owned</p><button className={styles.secondary} type="button" disabled={busy || equipped === coat} onClick={() => equip(coat)}>{equipped === coat ? 'Equipped' : 'Equip'}</button></div></div>)}</div>
  </>;
}
