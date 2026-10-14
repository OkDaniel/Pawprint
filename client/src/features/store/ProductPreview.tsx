import { useState } from 'react';
import { floorDecoration, resolveFloorVariant } from '@capstone/shared';
import { floorDecorationAsset } from '../decorations/assetManifest';
import { resolveCatAnimation } from '../home/catCatalog';
import styles from './Store.module.css';

export function ProductPreview({ productId, variantId }: { productId: string; variantId?: string | undefined }) {
  const product = floorDecoration(productId);
  const variant = product && resolveFloorVariant(product, variantId ?? product.defaultVariantId);
  const [failed, setFailed] = useState(false);
  if (!product) {
    const coat = resolveCatAnimation(productId, 'idle');
    return <span className={styles.coatPreview} role="img" aria-label={coat.appearance.displayName}
      style={{ backgroundImage: `url(${coat.animation.src})` }} />;
  }
  if (!variant || failed) return <span className={styles.muted}>Preview unavailable</span>;
  const scale = Math.max(1, Math.min(5, Math.floor(112 / Math.max(variant.width, variant.height))));
  return <img className={styles.art} width={variant.width * scale} height={variant.height * scale}
    src={floorDecorationAsset(product.id, variant.id)} alt={product.displayName} onError={() => setFailed(true)} />;
}
