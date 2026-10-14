import { floorDecoration, floorPlacementIssue, MAX_FLOOR_PLACEMENTS, type DecorationInventoryInstance, type FloorPlacement, type FloorPlacementInput, type PlacementIssue } from '@capstone/shared';

export function placementInputs(placements: readonly FloorPlacement[]): FloorPlacementInput[] {
  return placements.map(({ inventoryInstanceId, gridU, gridV }) => ({ inventoryInstanceId, gridU, gridV }));
}
export function sameLayout(a: readonly FloorPlacement[], b: readonly FloorPlacement[]) {
  const key = (items: readonly FloorPlacement[]) => JSON.stringify(placementInputs(items).sort((a, b) => a.inventoryInstanceId - b.inventoryInstanceId));
  return key(a) === key(b);
}
export function candidatePlacement(instance: DecorationInventoryInstance, gridU: number, gridV: number): FloorPlacement {
  return { inventoryInstanceId: instance.instanceId, productId: instance.productId, selectedVariantId: instance.selectedVariantId, gridU, gridV };
}
export function buildPlacementIssue(candidate: FloorPlacement, existing: readonly FloorPlacement[]): PlacementIssue | null {
  const product = floorDecoration(candidate.productId);
  if (!product) return { code: 'PRODUCT_NOT_FLOOR_ENABLED', message: 'This item cannot be placed in the room.' };
  if (!existing.some(p => p.inventoryInstanceId === candidate.inventoryInstanceId) && existing.length >= MAX_FLOOR_PLACEMENTS) {
    return { code: 'ROOM_ITEM_LIMIT', message: `The room holds ${MAX_FLOOR_PLACEMENTS} items. Remove one before adding another.` };
  }
  return floorPlacementIssue(candidate, product, existing);
}
