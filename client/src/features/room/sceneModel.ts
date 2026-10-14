import { floorDecoration, floorScenePoint, resolveFloorVariant, type FloorPlacement } from '@capstone/shared';

// Home's reviewed desktop 3× idle-frame contact, within the reserved floor region.
export const CAT_SCENE_CENTER = [256, 332.8] as const;
export const CAT_BASE_DEPTH = 377.8;

export function sceneObjects(placements: readonly FloorPlacement[]) {
  const decorations = placements.flatMap(placement => {
    const product = floorDecoration(placement.productId);
    const variant = product && resolveFloorVariant(product, placement.selectedVariantId);
    if (!product || !variant) return [];
    const [x, y] = floorScenePoint(placement.gridU, placement.gridV);
    return [{ kind: 'decoration' as const, key: placement.inventoryInstanceId,
      depth: y, x: x - variant.anchor[0], y: y - variant.anchor[1], product, variant, placement }];
  });
  return [...decorations, { kind: 'cat' as const, key: 0, depth: CAT_BASE_DEPTH }]
    .sort((a, b) => a.depth - b.depth || a.key - b.key);
}
