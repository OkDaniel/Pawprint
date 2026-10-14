import { floorPlacementIssue, resolveFloorVariant,
  MAX_FLOOR_PLACEMENTS, type FloorPlacement, type FloorPlacementInput } from '@capstone/shared';
export { FLOOR_GRID_SUBDIVISIONS, MAX_FLOOR_PLACEMENTS } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { catalogProduct } from '../economy/catalog.js';
import { RoomRepository, type OwnedDecoration } from './roomRepository.js';

export class RoomService {
  constructor(private readonly repository = new RoomRepository()) {}

  floorLayout(userId: number): Promise<FloorPlacement[]> {
    return this.repository.floorLayout(userId);
  }

  async saveFloorLayout(userId: number, placements: FloorPlacementInput[]): Promise<FloorPlacement[]> {
    await this.repository.replaceFloorLayout(userId, placements, (owned) => validateLayout(placements, owned));
    return this.repository.floorLayout(userId);
  }
}

export function validateLayout(placements: FloorPlacementInput[], owned: OwnedDecoration[]): void {
  if (placements.length > MAX_FLOOR_PLACEMENTS) {
    throw new AppError(400, 'ROOM_ITEM_LIMIT', `Place no more than ${MAX_FLOOR_PLACEMENTS} floor decorations.`);
  }
  const instanceIds = placements.map(({ inventoryInstanceId }) => inventoryInstanceId);
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new AppError(400, 'DUPLICATE_INVENTORY_INSTANCE', 'Each inventory item may appear only once.');
  }
  const ownedById = new Map(owned.map((instance) => [instance.instanceId, instance]));
  if (placements.some(placement => !ownedById.has(placement.inventoryInstanceId))) {
    throw new AppError(403, 'INVENTORY_NOT_OWNED', 'Every placed decoration must belong to the current user.');
  }

  const checked: Array<FloorPlacementInput & { productId: string }> = [];
  for (const placement of placements) {
    const instance = ownedById.get(placement.inventoryInstanceId)!;
    const product = catalogProduct(instance.productId);
    if (!product || product.kind !== 'decoration') {
      throw new AppError(400, 'PRODUCT_NOT_FLOOR_ENABLED', 'An inventory item cannot be placed on the floor.');
    }
    if (!resolveFloorVariant(product, instance.selectedVariantId)) {
      throw new AppError(500, 'INVENTORY_CATALOG_ERROR', 'An inventory variant is not valid for its product.');
    }
    const candidate = { ...placement, productId: product.id };
    const issue = floorPlacementIssue(candidate, product, checked);
    if (issue) throw new AppError(400, issue.code, issue.message);
    checked.push(candidate);
  }
}
