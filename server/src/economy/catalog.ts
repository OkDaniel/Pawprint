import { catAppearanceKeys, floorDecorations, legacyFloorVariantAliases,
  type CatAppearanceKey, type FloorDecorationDefinition } from '@capstone/shared';
export type { FloorPlacementContract } from '@capstone/shared';

interface CatalogProductBase {
  readonly id: string;
  price: number | null;
  purchasable: boolean;
  retired: boolean;
}

export interface CoatProduct extends CatalogProductBase {
  kind: 'coat';
  id: CatAppearanceKey;
}

export interface DecorationProduct extends CatalogProductBase, FloorDecorationDefinition {
  kind: 'decoration';
  variantIds: readonly string[];
}

export type CatalogProduct = CoatProduct | DecorationProduct;

export const catalogProducts: readonly CatalogProduct[] = [
  ...catAppearanceKeys.map((id): CoatProduct => ({ id, kind: 'coat', price: 1, purchasable: true, retired: false })),
  // Every family here passed the final 1x floor review. Purchase policy belongs
  // to the server; disabling/retiring a product must retain its render metadata.
  ...floorDecorations.map((definition): DecorationProduct => ({
    ...definition, kind: 'decoration', price: 1, purchasable: true, retired: false,
    variantIds: definition.variants.map(variant => variant.id),
  })),
];

export const retiredProductIds = new Set<string>();
export const retiredVariantIds = new Set<string>();
const productById = new Map<string, CatalogProduct>(catalogProducts.map((product) => [product.id, product]));

export function catalogProduct(productId: string): CatalogProduct | undefined {
  return productById.get(productId);
}

export function assertCatalogValid(products: readonly CatalogProduct[] = catalogProducts): void {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const product of products) {
    if (productIds.has(product.id)) throw new Error(`Duplicate catalog product ID: ${product.id}`);
    if (retiredProductIds.has(product.id) && !product.retired) throw new Error(`Retired catalog product ID was reused: ${product.id}`);
    productIds.add(product.id);
    if (product.purchasable && (product.price !== 1 || product.retired)) {
      throw new Error(`Purchasable catalog product must have prototype price 1 and be active: ${product.id}`);
    }
    if (product.kind !== 'decoration') continue;
    if (!product.variantIds.includes(product.defaultVariantId)) throw new Error(`Default variant is outside its family: ${product.id}`);
    const floor = product.floor;
    if (floor.surface !== 'floor' || floor.nativeScale !== 1 || floor.anchorRule !== 'front-base'
      || !Number.isInteger(floor.footprintU) || floor.footprintU <= 0
      || !Number.isInteger(floor.footprintV) || floor.footprintV <= 0) {
      throw new Error(`Decoration has no complete floor placement contract: ${product.id}`);
    }
    if (product.variantIds.length !== product.variants.length) throw new Error(`Variant metadata mismatch: ${product.id}`);
    const envelope = floor.artworkEnvelope;
    if (!Object.values(envelope).every(Number.isFinite) || envelope.left >= envelope.right || envelope.top >= envelope.bottom) {
      throw new Error(`Invalid family artwork envelope: ${product.id}`);
    }
    for (const variant of product.variants) {
      const variantId = variant.id;
      if (variantIds.has(variantId)) throw new Error(`Duplicate catalog variant ID: ${variantId}`);
      if (retiredVariantIds.has(variantId) && !product.retired) throw new Error(`Retired variant ID was reused: ${variantId}`);
      if (Object.hasOwn(legacyFloorVariantAliases, variantId)) throw new Error(`Legacy variant ID cannot be reused: ${variantId}`);
      if (!variantId.startsWith(`${product.id}_`) || !product.variantIds.includes(variantId)) throw new Error(`Variant is outside its family: ${variantId}`);
      const [ax,ay] = variant.anchor;
      if (![ax,ay,variant.width,variant.height].every(Number.isFinite)
        || variant.width <= 0 || variant.height <= 0 || ax < 0 || ay < 0 || ax > variant.width || ay > variant.height
        || -ax < envelope.left || -ay < envelope.top
        || variant.width-ax > envelope.right || variant.height-ay > envelope.bottom) {
        throw new Error(`Variant artwork exceeds its family envelope: ${variantId}`);
      }
      variantIds.add(variantId);
    }
  }
}

assertCatalogValid();
