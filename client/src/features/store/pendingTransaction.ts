import { purchaseRequestSchema } from '@capstone/shared';

export interface PendingPurchase { productId: string; requestId: string; variantId?: string | undefined }
export function readPending(userId: number): PendingPurchase | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`pawprint:purchase:${userId}`) ?? 'null');
    const result = purchaseRequestSchema.safeParse(value);
    if (!result.success) return null;
    const variantId = value && typeof value === 'object' && 'variantId' in value && typeof value.variantId === 'string' ? value.variantId : undefined;
    return { ...result.data, variantId };
  } catch { return null; }
}
export function storePending(userId: number, purchase: PendingPurchase | null) {
  try {
    if (purchase) sessionStorage.setItem(`pawprint:purchase:${userId}`, JSON.stringify(purchase));
    else sessionStorage.removeItem(`pawprint:purchase:${userId}`);
  } catch { /* The mounted Store still retains the exact request in memory. */ }
}
