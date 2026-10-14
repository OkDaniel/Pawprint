import { afterEach, describe, expect, it, vi } from 'vitest';
import { floorDecorations } from '@capstone/shared';
import * as catalog from '../economy/catalog.js';
import { validateLayout } from './roomService.js';

const yarn = (instanceId: number) => ({
  instanceId, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_base',
});

describe('production floor layout validation', () => {
  it('accepts a sparse 16x16 floor layout', () => {
    expect(() => validateLayout([
      { inventoryInstanceId: 1, gridU: 2, gridV: 2 },
      { inventoryInstanceId: 2, gridU: 5, gridV: 5 },
    ], [yarn(1), yarn(2)])).not.toThrow();
  });

  it.each([
    {
      name: 'duplicate instance',
      placements: [{ inventoryInstanceId: 1, gridU: 2, gridV: 2 }, { inventoryInstanceId: 1, gridU: 3, gridV: 3 }],
      owned: [yarn(1)], code: 'DUPLICATE_INVENTORY_INSTANCE',
    },
    {
      name: 'cross-user or missing instance',
      placements: [{ inventoryInstanceId: 2, gridU: 2, gridV: 2 }],
      owned: [], code: 'INVENTORY_NOT_OWNED',
    },
    {
      name: 'collision',
      placements: [{ inventoryInstanceId: 1, gridU: 2, gridV: 2 }, { inventoryInstanceId: 2, gridU: 2, gridV: 2 }],
      owned: [yarn(1), yarn(2)], code: 'PLACEMENT_COLLISION',
    },
    {
      name: 'bounds',
      placements: [{ inventoryInstanceId: 3, gridU: 2, gridV: 2 }],
      owned: [{ instanceId: 3, productId: 'decor_cat_bed_cushioned', selectedVariantId: 'decor_cat_bed_cushioned_base' }],
      code: 'PLACEMENT_OUT_OF_BOUNDS',
    },
    {
      name: 'Mochi clearance',
      placements: [{ inventoryInstanceId: 1, gridU: 11, gridV: 12 }],
      owned: [yarn(1)], code: 'MOCHI_CLEARANCE_REQUIRED',
    },
  ])('rejects $name atomically', ({ placements, owned, code }) => {
    expect(() => validateLayout(placements, owned)).toThrow(expect.objectContaining({ code }));
  });

  it('rejects item 21', () => {
    const placements = Array.from({ length: 21 }, (_, index) => ({ inventoryInstanceId: index + 1, gridU: 1, gridV: 1 }));
    expect(() => validateLayout(placements, placements.map(({ inventoryInstanceId }) => yarn(inventoryInstanceId))))
      .toThrow(expect.objectContaining({ code: 'ROOM_ITEM_LIMIT' }));
  });
});

describe('frozen family artwork and ownership rules', () => {
  it('rejects artwork clipping separately from a legal floor footprint', () => {
    // This footprint is inside the 16x16 floor, but the bed rectangle crosses the shell edge.
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:16,gridV:4}], [
      {instanceId:1,productId:'decor_cat_bed_cushioned',selectedVariantId:'decor_cat_bed_cushioned_blue'},
    ])).toThrow(expect.objectContaining({code:'PLACEMENT_ARTWORK_OUT_OF_BOUNDS'}));
  });

  it('rejects fractional/invented coordinates, product IDs and cross-family variants', () => {
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:2.5,gridV:2}], [yarn(1)]))
      .toThrow(expect.objectContaining({code:'PLACEMENT_OUT_OF_BOUNDS'}));
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:8,gridV:8}], [
      {instanceId:1,productId:'room_decor_007',selectedVariantId:'room_decor_007_v01'},
    ])).toThrow(expect.objectContaining({code:'PRODUCT_NOT_FLOOR_ENABLED'}));
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:8,gridV:8}], [
      {instanceId:1,productId:'decor_yarn_ball',selectedVariantId:'decor_bowl_blue'},
    ])).toThrow(expect.objectContaining({code:'INVENTORY_CATALOG_ERROR'}));
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:2,gridV:2}], [yarn(2)]))
      .toThrow(expect.objectContaining({code:'INVENTORY_NOT_OWNED'}));
  });

  it('uses body/stem footprints independently of large mouse/perch artwork', () => {
    expect(() => validateLayout([
      {inventoryInstanceId:1,gridU:8,gridV:8}, {inventoryInstanceId:2,gridU:9,gridV:8},
    ], [
      {instanceId:1,productId:'decor_toy_mouse_plush',selectedVariantId:'decor_toy_mouse_plush_brown'},
      {instanceId:2,productId:'decor_cat_perch_tall',selectedVariantId:'decor_cat_perch_tall_mint'},
    ])).not.toThrow();
  });
});


describe('all approved finish placement invariance', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(floorDecorations)('$id permits every finish at every legal logical position', (product) => {
    let legalPositions = 0;
    for (let gridU=0;gridU<=16;gridU++) for (let gridV=0;gridV<=16;gridV++) {
      const placements = [{inventoryInstanceId:1,gridU,gridV}];
      try {
        validateLayout(placements,[{instanceId:1,productId:product.id,selectedVariantId:product.defaultVariantId}]);
      } catch { continue; }
      legalPositions += 1;
      for (const variant of product.variants) {
        expect(() => validateLayout(placements,[{instanceId:1,productId:product.id,selectedVariantId:variant.id}]), variant.id).not.toThrow();
      }
    }
    expect(legalPositions).toBeGreaterThan(0);
  });

  it('retains placement support for already-owned disabled/retired products', () => {
    const product = catalog.catalogProduct('decor_cat_bed_cushioned')!;
    vi.spyOn(catalog,'catalogProduct').mockReturnValue({...product,purchasable:false,price:null,retired:true});
    expect(() => validateLayout([{inventoryInstanceId:1,gridU:8,gridV:8}],[
      {instanceId:1,productId:product.id,selectedVariantId:'decor_cat_bed_cushioned_blue'},
    ])).not.toThrow();
  });

  it.each(['decor_cat_tree_multilevel','decor_cat_bed_cushioned','decor_toy_mouse_plush'])('%s respects collisions and Mochi cells for every finish', (id) => {
    const product = floorDecorations.find(product => product.id===id)!;
    for (const variant of product.variants) {
      const instance = {instanceId:1,productId:id,selectedVariantId:variant.id};
      expect(() => validateLayout([{inventoryInstanceId:1,gridU:11,gridV:12}],[instance]))
        .toThrow(expect.objectContaining({code:'MOCHI_CLEARANCE_REQUIRED'}));
      expect(() => validateLayout([{inventoryInstanceId:1,gridU:8,gridV:8},{inventoryInstanceId:2,gridU:8,gridV:8}],
        [instance,{...instance,instanceId:2}])).toThrow(expect.objectContaining({code:'PLACEMENT_COLLISION'}));
    }
  });
});
