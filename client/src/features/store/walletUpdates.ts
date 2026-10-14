import type { WalletResponse } from '@capstone/shared';

export const WALLET_UPDATED_EVENT = 'pawprint:wallet-updated';

export function notifyWalletUpdated(wallet?: WalletResponse) {
  window.dispatchEvent(new CustomEvent<WalletResponse | undefined>(WALLET_UPDATED_EVENT, { detail: wallet }));
}
