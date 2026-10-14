import { floorDecoration, resolveFloorVariant, type DecorationInventoryInstance } from '@capstone/shared';

// Presentation numbers follow immutable IDs, never finish, placement, or API order.
// IDs remain internal; names and copy numbers are the visible identity.
export function inventoryPresentation(inventory: readonly DecorationInventoryInstance[]) {
  const ordered = [...inventory].sort((a, b) => a.instanceId - b.instanceId);
  const totals = new Map<string, number>();
  const copies = new Map<string, number>();
  const name = (instance: DecorationInventoryInstance) => floorDecoration(instance.productId)?.displayName ?? 'Unavailable item';
  for (const instance of ordered) totals.set(name(instance), (totals.get(name(instance)) ?? 0) + 1);
  return ordered.map(instance => {
    const product = floorDecoration(instance.productId);
    const productName = name(instance);
    const copy = (copies.get(productName) ?? 0) + 1;
    copies.set(productName, copy);
    return {
      instance, product, label: totals.get(productName)! > 1 ? `${productName} ${copy}` : productName,
      finish: product && resolveFloorVariant(product, instance.selectedVariantId)?.label || 'Finish unavailable',
    };
  });
}
