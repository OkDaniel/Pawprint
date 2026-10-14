import { describe, expect, it } from 'vitest';
import { floorDecorations, floorScenePoint, snapFloorNode } from '@capstone/shared';
import { buildPlacementIssue, sameLayout, placementInputs } from './buildModel';

const item = (id: number, gridU = 8, gridV = 8, productId = 'decor_yarn_ball') => ({ inventoryInstanceId: id, gridU, gridV, productId, selectedVariantId: 'decor_yarn_ball_sage' });
describe('production Build geometry and layout', () => {
  it('snaps the canonical lattice and preserves outside nodes for useful rejection', () => {
    expect(snapFloorNode(floorScenePoint(8.2, 7.8))).toEqual([8, 8]);
    expect(snapFloorNode(floorScenePoint(18, 8))).toEqual([18, 8]);
    expect(buildPlacementIssue(item(1, 18, 8), [])?.code).toBe('PLACEMENT_OUT_OF_BOUNDS');
  });
  it('rejects collisions and the reserved Mochi cells while allowing moving the same instance', () => {
    expect(buildPlacementIssue(item(2), [item(1)])?.code).toBe('PLACEMENT_COLLISION');
    expect(buildPlacementIssue(item(1), [item(1)])).toBeNull();
    expect(buildPlacementIssue(item(1, 11, 12), [])?.code).toBe('MOCHI_CLEARANCE_REQUIRED');
  });
  it('uses the 20 item cap and family artwork envelope', () => {
    expect(buildPlacementIssue(item(21), Array.from({ length: 20 }, (_, n) => item(n + 1)))?.code).toBe('ROOM_ITEM_LIMIT');
    expect(buildPlacementIssue(item(1, 16, 4, 'decor_cat_bed_cushioned'), [])?.code).toBe('PLACEMENT_ARTWORK_OUT_OF_BOUNDS');
  });
  it.each(floorDecorations)('provides at least one legal placement for every purchasable $displayName', product => {
    const hasLegalNode = Array.from({ length: 289 }, (_, n) => [n % 17, Math.floor(n / 17)]).some(([u, v]) => !buildPlacementIssue(item(1, u, v, product.id), []));
    expect(hasLegalNode).toBe(true);
  });
  it('serializes only identity and nodes, ignoring order and visual finishes for dirty detection', () => {
    expect(placementInputs([item(1)])).toEqual([{ inventoryInstanceId: 1, gridU: 8, gridV: 8 }]);
    expect(sameLayout([item(2), item(1)], [{ ...item(1), selectedVariantId: 'decor_yarn_ball_red' }, item(2)])).toBe(true);
    expect(sameLayout([item(1)], [item(1, 9, 8)])).toBe(false);
  });
});
