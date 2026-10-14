import { useState } from 'react';
import { floorDecoration, type CatAppearanceKey, type DecorationInventoryInstance, type StoreProduct } from '@capstone/shared';
import { ProductPreview } from './ProductPreview';
import { categories, coatNames, usableProduct } from './storeCatalog';
import styles from './Store.module.css';

export function Shop({ products, balance, inventory, coats, equipped, busy, pending, buy, equip }: {
  products: StoreProduct[]; balance: number | undefined; inventory: DecorationInventoryInstance[] | undefined;
  coats: CatAppearanceKey[] | undefined; equipped: string; busy: boolean; pending: boolean;
  buy(productId: string, variantId?: string | undefined): void; equip(coat: CatAppearanceKey): void;
}) {
  const [category, setCategory] = useState('All');
  const [finishes, setFinishes] = useState<Record<string, string>>({});
  const available = products.filter(p => p.purchasable && !p.retired && p.price !== null && usableProduct(p));
  const visible = available.filter(p => category === 'All' || (p.kind === 'coat' ? 'Cat Coats' : floorDecoration(p.id)?.category) === category);
  return <>
    <div className={styles.intro}><div><h2>A little more at home</h2></div><p className={styles.muted}>Earn coins by checking in once each day.</p></div>
    <nav className={styles.categories} aria-label="Shop categories">{categories.map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</nav>
    <div className={styles.products}>
      {visible.map(p => {
        const decoration = floorDecoration(p.id);
        const finish = finishes[p.id] ?? decoration?.defaultVariantId;
        const ownedCoat = coats?.includes(p.id as CatAppearanceKey);
        const ownedCount = inventory?.filter(i => i.productId === p.id).length ?? 0;
        return <article className={styles.product} key={p.id} aria-label={decoration?.displayName ?? coatNames[p.id]}>
          <div className={styles.preview}><ProductPreview key={finish ?? p.id} productId={p.id} variantId={finish} /></div>
          <span className={styles.eyebrow}>{decoration?.category ?? 'Cat Coats'}</span>
          <h3>{decoration?.displayName ?? coatNames[p.id]}</h3>
          {decoration && <label className={styles.finish}>Finish<select value={finish} onChange={event => setFinishes(old => ({ ...old, [p.id]: event.target.value }))}>{decoration.variants.map(v => <option value={v.id} key={v.id}>{v.label}</option>)}</select></label>}
          <div className={styles.productFooter}><span className={styles.price}><span aria-hidden="true">●</span> {p.price} {p.price === 1 ? 'coin' : 'coins'}</span>
            {ownedCoat ? <button className={styles.secondary} type="button" disabled={busy || equipped === p.id} onClick={() => equip(p.id as CatAppearanceKey)}>{equipped === p.id ? 'Equipped' : 'Equip'}</button>
              : <button className={styles.primary} type="button" disabled={busy || pending || balance === undefined || !inventory || !coats || balance < p.price!}
                aria-label={`Buy ${decoration?.displayName ?? coatNames[p.id]}`} onClick={() => buy(p.id, finish)}>Buy</button>}
          </div>
          <span className={styles.ownership}>{ownedCoat ? 'Owned' : decoration && ownedCount ? `${ownedCount} owned` : balance !== undefined && balance < p.price! ? 'Not enough coins' : '\u00a0'}</span>
        </article>;
      })}
    </div>
    {!visible.length && <p>No items are available in this category.</p>}
  </>;
}
