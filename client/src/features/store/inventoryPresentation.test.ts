import { describe, expect, it } from 'vitest';
import { inventoryPresentation } from './inventoryPresentation';

const item = (instanceId: number, selectedVariantId = 'decor_yarn_ball_sage') => ({ instanceId, productId: 'decor_yarn_ball', selectedVariantId, purchaseTransactionId: instanceId + 100, acquiredAt: '2026-10-07T12:00:00Z' });
describe('owned copy presentation', () => {
  it('keeps copy numbers stable across API ordering and finish changes without changing identities', () => {
    const first = [item(37), item(35)];
    expect(inventoryPresentation(first).map(({ instance, label }) => [instance.instanceId, label])).toEqual([[35, 'Yarn Ball 1'], [37, 'Yarn Ball 2']]);
    expect(first.map(i => i.instanceId)).toEqual([37, 35]);
    const updated = inventoryPresentation([item(35, 'decor_yarn_ball_red'), item(37)]);
    expect(updated.map(({ instance, label, finish }) => [instance.instanceId, label, finish])).toEqual([[35, 'Yarn Ball 1', 'Red'], [37, 'Yarn Ball 2', 'Sage']]);
  });
  it('uses the product name alone for a single owned copy', () => {
    expect(inventoryPresentation([item(123)])[0]!.label).toBe('Yarn Ball');
  });
});
