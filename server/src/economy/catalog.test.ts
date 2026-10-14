import { describe, expect, it } from 'vitest';
import { floorDecoration, floorDecorations, legacyFloorVariantAliases } from '@capstone/shared';
import { assertCatalogValid, catalogProduct, catalogProducts, retiredProductIds, retiredVariantIds, type DecorationProduct } from './catalog.js';

const bed = catalogProduct('decor_cat_bed_cushioned') as DecorationProduct;

describe('server-authoritative frozen floor catalog', () => {
  it('enables all 16 reviewed families at 1 coin, and keeps walls/unreviewed families unavailable', () => {
    expect(() => assertCatalogValid()).not.toThrow();
    expect(catalogProducts.filter(p => p.kind === 'decoration' && p.purchasable)).toHaveLength(16);
    expect(catalogProducts.filter(p => p.kind === 'coat' && p.purchasable)).toHaveLength(4);
    for (const product of catalogProducts) if (product.purchasable) expect(product.price).toBe(1);
    for (const id of ['room_decor_001', 'decor_window', 'room_decor_004', 'decor_food_bag']) expect(catalogProduct(id)).toBeUndefined();
  });

  it('uses the exact shared family contract and excludes legacy aliases from selectable variants/defaults', () => {
    for (const product of catalogProducts) {
      if (product.kind !== 'decoration') continue;
      expect(product.floor).toBe(floorDecoration(product.id)!.floor);
      expect(product.variants).toBe(floorDecoration(product.id)!.variants);
      expect(product.variantIds).toContain(product.defaultVariantId);
      expect(product.variantIds.every(id => !Object.hasOwn(legacyFloorVariantAliases,id))).toBe(true);
    }
    expect(floorDecorations.flatMap(p => p.variants)).toHaveLength(74);
  });

  it('rejects duplicate product/variant identities, invalid defaults, prices, footprints and envelopes', () => {
    expect(() => assertCatalogValid([bed, bed])).toThrow(/Duplicate catalog product/);
    expect(() => assertCatalogValid([{...bed, variants: [bed.variants[0]!,bed.variants[0]!], variantIds: [bed.defaultVariantId,bed.defaultVariantId]}])).toThrow(/Duplicate catalog variant/);
    expect(() => assertCatalogValid([{...bed, defaultVariantId: 'invented'}])).toThrow(/Default variant/);
    expect(() => assertCatalogValid([{...bed, price: 2}])).toThrow(/prototype price/);
    expect(() => assertCatalogValid([{...bed, floor: {...bed.floor, footprintU: 0}}])).toThrow(/placement contract/);
    expect(() => assertCatalogValid([{...bed, floor: {...bed.floor, artworkEnvelope: {left: 0, top: 0, right: 1, bottom: 1}}}])).toThrow(/exceeds its family envelope/);
  });

  it('reserves retired product/variant IDs while retaining disabled and retired rendering metadata', () => {
    retiredProductIds.add(bed.id); retiredVariantIds.add(bed.defaultVariantId);
    try {
      expect(() => assertCatalogValid([bed])).toThrow(/Retired catalog product ID was reused/);
      const retired = {...bed, price: null, purchasable: false, retired: true};
      expect(() => assertCatalogValid([retired])).not.toThrow();
      retiredProductIds.delete(bed.id);
      expect(() => assertCatalogValid([bed])).toThrow(/Retired variant ID was reused/);
      retiredVariantIds.delete(bed.defaultVariantId);
      expect(() => assertCatalogValid([{...bed, price: null, purchasable: false}])).not.toThrow();
    } finally {
      retiredProductIds.delete(bed.id); retiredVariantIds.delete(bed.defaultVariantId);
    }
  });
});
