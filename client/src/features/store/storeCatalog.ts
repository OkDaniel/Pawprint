import { catAppearanceKeys, floorDecoration, type StoreProduct } from '@capstone/shared';
import { floorDecorationAsset } from '../decorations/assetManifest';

export const categories = ['All', 'Cat Furniture', 'Furniture', 'Plants', 'Toys', 'Feeding', 'Cat Coats'];
export const coatNames: Record<string, string> = { 'mochi-classic': 'Classic Coat', 'mochi-grey': 'Grey Coat', 'mochi-orange': 'Orange Coat', 'mochi-white': 'White Coat' };
export function usableProduct(product: StoreProduct) {
  if (product.kind === 'coat') return catAppearanceKeys.includes(product.id as typeof catAppearanceKeys[number]);
  const definition = floorDecoration(product.id);
  return Boolean(definition && definition.variants.every(v => floorDecorationAsset(definition.id, v.id)));
}
