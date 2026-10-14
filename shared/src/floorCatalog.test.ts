import { describe, expect, it } from 'vitest';
import { floorDecorations, legacyFloorVariantAliases, resolveFloorVariant } from './floorCatalog.js';
import { familyArtworkFitsRoom, floorFootprintCells, floorScenePoint, FLOOR_GRID_SUBDIVISIONS,
  isMochiReservedCell, MAX_FLOOR_PLACEMENTS, MOCHI_RESERVED_REGION } from './roomGeometry.js';

// Independent identity lock: intentional additions require review, never sorting/naming edits.
const expectedFinishes: Record<string, string[]> = {
  decor_yarn_ball: ['sage','slate','sky_blue','cream','red','grey','teal','indigo','plum','olive','gold','purple'],
  decor_cat_tree_multilevel: ['cream','aqua','lavender'],
  decor_cat_bed_cushioned: ['blue','grey','rose','olive','purple','teal'],
  decor_plant_small_potted: ['rose','grey','cream','blue','lime','indigo'],
  decor_cat_tower_stair: ['honey','cream'],
  decor_bookshelf_open: ['peach','blue','sage','purple','sand'],
  decor_plant_large_potted: ['brown','navy','plum','blue'],
  decor_scratching_post_round: ['cream','brown'],
  decor_bowl: ['blue','sand','purple','white','rose','sage'],
  decor_cat_perch_double: ['cream','peach','blue','rose','sage'],
  decor_table_low_square: ['cream','grey','rose','blue','lavender'],
  decor_tin_round: ['red','sand','grey','pink','purple','green','navy','teal'],
  decor_toy_block: ['multicolor'], decor_toy_bone: ['tan','cream'],
  decor_toy_mouse_plush: ['brown'], decor_cat_perch_tall: ['cream','mint','blue','lavender','rose','peach'],
};

describe('immutable semantic floor identities and variant contracts', () => {
  it('locks all explicit product and finish IDs, independently of array order and display labels', () => {
    expect(floorDecorations.map(p => p.id).sort()).toEqual(Object.keys(expectedFinishes).sort());
    const ids = floorDecorations.flatMap(p => p.variants.map(v => v.id));
    expect(new Set(ids).size).toBe(74);
    for (const product of floorDecorations) {
      expect(product.variants.map(v => v.id).sort()).toEqual(expectedFinishes[product.id]!.map(finish => `${product.id}_${finish}`).sort());
      const edited = {...product, displayName: 'Renamed', variants: [...product.variants].reverse().map(v => ({...v,label:'Renamed finish'}))};
      expect(resolveFloorVariant(edited,product.defaultVariantId)?.id).toBe(product.defaultVariantId);
      expect(product.variants.some(v => v.id === product.defaultVariantId)).toBe(true);
      expect(resolveFloorVariant(product,'room_decor_007_v01')).toBeUndefined();
    }
  });

  it('reserves every earlier placeholder as a family-scoped rendering alias', () => {
    expect(Object.keys(legacyFloorVariantAliases)).toHaveLength(16);
    for (const product of floorDecorations) {
      expect(resolveFloorVariant(product,`${product.id}_base`)?.id).toBe(product.defaultVariantId);
      expect(resolveFloorVariant(product,'decor_unknown_base')).toBeUndefined();
    }
    expect(resolveFloorVariant(floorDecorations[1], 'decor_yarn_ball_base')).toBeUndefined();
    expect(resolveFloorVariant(floorDecorations[0], 'toString')).toBeUndefined();
  });

  it('covers every variant crop with a single family envelope distinct from footprint occupancy', () => {
    for (const product of floorDecorations) {
      const e = product.floor.artworkEnvelope;
      for (const variant of product.variants) {
        const [x,y] = variant.anchor;
        expect(e.left).toBeLessThanOrEqual(-x); expect(e.top).toBeLessThanOrEqual(-y);
        expect(e.right).toBeGreaterThanOrEqual(variant.width-x); expect(e.bottom).toBeGreaterThanOrEqual(variant.height-y);
      }
      expect(floorFootprintCells(8,8,product.floor)).toHaveLength(product.floor.footprintU*product.floor.footprintV);
      expect(familyArtworkFitsRoom(8,8,e),product.id).toBe(true);
    }
    const tree = floorDecorations[1];
    expect(tree.variants[0].height).toBe(175);
    expect(floorFootprintCells(8,8,tree.floor)).toHaveLength(9);
  });

  it('freezes the inset 16x16 lattice, 20 item cap and 3x3 Mochi reservation', () => {
    expect(FLOOR_GRID_SUBDIVISIONS).toBe(16); expect(MAX_FLOOR_PLACEMENTS).toBe(20);
    expect(floorScenePoint(0,0)).toEqual([257,203]); expect(floorScenePoint(16,16)).toEqual([257,443]);
    expect(MOCHI_RESERVED_REGION).toEqual({minU:10,maxU:12,minV:11,maxV:13});
    const cells = [];
    for(let u=0;u<16;u++) for(let v=0;v<16;v++) if(isMochiReservedCell(u,v)) cells.push([u,v]);
    expect(cells).toHaveLength(9); expect(cells).toContainEqual([12,13]);
    expect(isMochiReservedCell(13,13)).toBe(false);
  });
});
