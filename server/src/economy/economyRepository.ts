import type { CatAppearanceKey, DecorationInventoryInstance, PurchaseResult } from '@capstone/shared';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';
import { AppError } from '../errors/AppError.js';
import type { CatalogProduct } from './catalog.js';

interface WalletRow extends RowDataPacket { coin_balance: number | string }
interface LedgerRow extends RowDataPacket {
  id: number | string;
  amount: number | string;
  transaction_type: string;
  product_id: string | null;
}
interface InventoryRow extends RowDataPacket {
  instance_id: number | string;
  product_id: string;
  selected_variant_id: string;
  purchase_transaction_id: number | string;
  created_at: Date | string;
}
interface CheckInCreationRow extends RowDataPacket {
  id: number | string;
  occurred_at: Date | string;
  logical_date: Date | string;
  created_at: Date | string;
}

export interface CheckInCreationMetadata {
  id: number;
  occurredAt: Date;
  logicalDate: string;
  createdAt: Date;
}

export interface WalletIntegrityMismatch {
  userId: number;
  walletBalance: number;
  ledgerBalance: number;
}

export class EconomyRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async wallet(userId: number): Promise<number> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<WalletRow[]>(
        'SELECT coin_balance FROM user_wallets WHERE user_id = ? FOR UPDATE', [userId],
      );
      if (rows[0]) {
        await connection.commit();
        return Number(rows[0].coin_balance);
      }
      const [sums] = await connection.execute<Array<RowDataPacket & { balance: number | string }>>(
        'SELECT COALESCE(SUM(amount), 0) AS balance FROM coin_transactions WHERE user_id = ?', [userId],
      );
      const reconstructed = Number(sums[0]?.balance ?? 0);
      if (!Number.isSafeInteger(reconstructed) || reconstructed < 0) {
        throw new AppError(500, 'WALLET_INTEGRITY_ERROR', 'The game wallet could not be recovered safely.');
      }
      await connection.execute('INSERT INTO user_wallets (user_id, coin_balance) VALUES (?, ?)', [userId, reconstructed]);
      await connection.commit();
      if (reconstructed !== 0) console.warn('Reconstructed a missing Pawprint wallet from its ledger.', { userId });
      return reconstructed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async grantDailyReward(userId: number, logicalDate: string): Promise<{ granted: boolean; balance: number }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const balance = await ensureAndLockWallet(connection, userId);
      const idempotencyKey = `daily_checkin:${logicalDate}`;
      const [existing] = await connection.execute<LedgerRow[]>(
        'SELECT id, amount, transaction_type, product_id FROM coin_transactions WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [userId, idempotencyKey],
      );
      if (existing.length > 0) {
        await connection.commit();
        return { granted: false, balance };
      }
      await connection.execute(
        `INSERT INTO coin_transactions
           (user_id, amount, transaction_type, idempotency_key, logical_date)
         VALUES (?, 1, 'DAILY_CHECKIN_REWARD', ?, ?)`,
        [userId, idempotencyKey, logicalDate],
      );
      const nextBalance = balance + 1;
      await connection.execute('UPDATE user_wallets SET coin_balance = ? WHERE user_id = ?', [nextBalance, userId]);
      await connection.commit();
      return { granted: true, balance: nextBalance };
    } catch (error) {
      await connection.rollback();
      if (isDuplicateEntry(error)) {
        const [rows] = await connection.execute<WalletRow[]>(
          'SELECT coin_balance FROM user_wallets WHERE user_id = ? LIMIT 1', [userId],
        );
        return { granted: false, balance: Number(rows[0]?.coin_balance ?? 0) };
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async purchase(userId: number, product: CatalogProduct, requestId: string): Promise<PurchaseResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const balance = await ensureAndLockWallet(connection, userId);
      const idempotencyKey = `purchase:${requestId}`;
      const [existing] = await connection.execute<LedgerRow[]>(
        'SELECT id, amount, transaction_type, product_id FROM coin_transactions WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [userId, idempotencyKey],
      );
      const replay = existing[0];
      if (replay) {
        if (replay.transaction_type !== 'PURCHASE' || replay.product_id !== product.id) {
          throw new AppError(409, 'PURCHASE_REQUEST_CONFLICT', 'That purchase request ID was already used for another product.');
        }
        const result = await this.purchaseResult(connection, userId, product, Number(replay.id), balance);
        await connection.commit();
        return result;
      }

      const [users] = await connection.execute<Array<RowDataPacket & { onboarding_completed_at: Date | null }>>(
        'SELECT onboarding_completed_at FROM users WHERE id = ? LIMIT 1', [userId],
      );
      if (!users[0] || users[0].onboarding_completed_at === null) {
        throw new AppError(409, 'ONBOARDING_REQUIRED', 'Complete companion setup before using the Store.');
      }
      if (!product.purchasable || product.retired || product.price === null) {
        throw new AppError(409, 'PRODUCT_NOT_PURCHASABLE', 'That product is not currently available.');
      }
      if (balance < product.price) throw new AppError(409, 'INSUFFICIENT_COINS', 'You do not have enough coins.');
      if (product.kind === 'coat') {
        const [owned] = await connection.execute<RowDataPacket[]>(
          'SELECT coat_id FROM user_cat_coats WHERE user_id = ? AND coat_id = ? LIMIT 1', [userId, product.id],
        );
        if (owned.length > 0) throw new AppError(409, 'COAT_ALREADY_OWNED', 'You already own that coat.');
      }

      const [transaction] = await connection.execute<ResultSetHeader>(
        `INSERT INTO coin_transactions
           (user_id, amount, transaction_type, idempotency_key, product_id)
         VALUES (?, ?, 'PURCHASE', ?, ?)`,
        [userId, -product.price, idempotencyKey, product.id],
      );
      const nextBalance = balance - product.price;
      await connection.execute('UPDATE user_wallets SET coin_balance = ? WHERE user_id = ?', [nextBalance, userId]);
      let inventoryInstanceId: number | undefined;
      if (product.kind === 'coat') {
        await connection.execute('INSERT INTO user_cat_coats (user_id, coat_id) VALUES (?, ?)', [userId, product.id]);
      } else {
        const [inventory] = await connection.execute<ResultSetHeader>(
          `INSERT INTO user_decoration_inventory
             (user_id, product_id, selected_variant_id, purchase_transaction_id)
           VALUES (?, ?, ?, ?)`,
          [userId, product.id, product.defaultVariantId, transaction.insertId],
        );
        inventoryInstanceId = inventory.insertId;
      }
      await connection.commit();
      return {
        transactionId: transaction.insertId,
        productId: product.id,
        balance: nextBalance,
        ...(product.kind === 'coat' ? { coatId: product.id } : { inventoryInstanceId: inventoryInstanceId! }),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async devGrant(userId: number, amount: number, requestId: string): Promise<{ transactionId: number; balance: number }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const balance = await ensureAndLockWallet(connection, userId);
      const idempotencyKey = `dev_grant:${requestId}`;
      const [existing] = await connection.execute<LedgerRow[]>(
        'SELECT id, amount, transaction_type, product_id FROM coin_transactions WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [userId, idempotencyKey],
      );
      const replay = existing[0];
      if (replay) {
        if (replay.transaction_type !== 'DEV_GRANT' || Number(replay.amount) !== amount) {
          throw new AppError(409, 'DEV_GRANT_REQUEST_CONFLICT', 'That grant request ID was already used with another amount.');
        }
        await connection.commit();
        return { transactionId: Number(replay.id), balance };
      }
      const [transaction] = await connection.execute<ResultSetHeader>(
        `INSERT INTO coin_transactions (user_id, amount, transaction_type, idempotency_key)
         VALUES (?, ?, 'DEV_GRANT', ?)`, [userId, amount, idempotencyKey],
      );
      const nextBalance = balance + amount;
      await connection.execute('UPDATE user_wallets SET coin_balance = ? WHERE user_id = ?', [nextBalance, userId]);
      await connection.commit();
      return { transactionId: transaction.insertId, balance: nextBalance };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async inventory(userId: number): Promise<DecorationInventoryInstance[]> {
    const [rows] = await this.pool.execute<InventoryRow[]>(
      `SELECT instance_id, product_id, selected_variant_id, purchase_transaction_id, created_at
       FROM user_decoration_inventory WHERE user_id = ? ORDER BY instance_id`, [userId],
    );
    return rows.map(toInventoryInstance);
  }

  async ownedCoats(userId: number): Promise<CatAppearanceKey[]> {
    const [rows] = await this.pool.execute<Array<RowDataPacket & { coat_id: CatAppearanceKey }>>(
      'SELECT coat_id FROM user_cat_coats WHERE user_id = ? ORDER BY coat_id', [userId],
    );
    return rows.map(row => row.coat_id);
  }

  async inventoryInstance(userId: number, instanceId: number): Promise<DecorationInventoryInstance | null> {
    const [rows] = await this.pool.execute<InventoryRow[]>(
      `SELECT instance_id, product_id, selected_variant_id, purchase_transaction_id, created_at
       FROM user_decoration_inventory WHERE user_id = ? AND instance_id = ? LIMIT 1`, [userId, instanceId],
    );
    return rows[0] ? toInventoryInstance(rows[0]) : null;
  }

  async updateInventoryVariant(userId: number, instanceId: number, variantId: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE user_decoration_inventory SET selected_variant_id = ? WHERE user_id = ? AND instance_id = ?',
      [variantId, userId, instanceId],
    );
    return result.affectedRows === 1;
  }

  async qualifyingCheckIns(userId: number, logicalDates: string[], rewardsStartAt: Date): Promise<CheckInCreationMetadata[]> {
    if (logicalDates.length === 0) return [];
    const placeholders = logicalDates.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<CheckInCreationRow[]>(
      `SELECT ci.id, ci.occurred_at, ci.logical_date, ci.created_at
       FROM check_ins ci
       WHERE ci.user_id = ?
         AND ci.logical_date IN (${placeholders})
         AND ci.client_request_id IS NOT NULL
         AND ci.created_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM coin_transactions ct
           WHERE ct.user_id = ci.user_id
             AND ct.transaction_type = 'DAILY_CHECKIN_REWARD'
             AND ct.logical_date = ci.logical_date
         )
       ORDER BY ci.logical_date, ci.id`,
      [userId, ...logicalDates, rewardsStartAt],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      occurredAt: asDate(row.occurred_at),
      logicalDate: asDateString(row.logical_date),
      createdAt: asDate(row.created_at),
    }));
  }

  async walletIntegrityMismatches(): Promise<WalletIntegrityMismatch[]> {
    const [rows] = await this.pool.execute<Array<RowDataPacket & {
      user_id: number | string;
      wallet_balance: number | string;
      ledger_balance: number | string;
    }>>(
      `SELECT w.user_id, w.coin_balance AS wallet_balance, COALESCE(SUM(t.amount), 0) AS ledger_balance
       FROM user_wallets w LEFT JOIN coin_transactions t ON t.user_id = w.user_id
       GROUP BY w.user_id, w.coin_balance
       HAVING w.coin_balance <> COALESCE(SUM(t.amount), 0)`,
    );
    return rows.map((row) => ({
      userId: Number(row.user_id),
      walletBalance: Number(row.wallet_balance),
      ledgerBalance: Number(row.ledger_balance),
    }));
  }

  private async purchaseResult(
    connection: PoolConnection,
    userId: number,
    product: CatalogProduct,
    transactionId: number,
    balance: number,
  ): Promise<PurchaseResult> {
    if (product.kind === 'coat') {
      return { transactionId, productId: product.id, coatId: product.id, balance };
    }
    const [inventory] = await connection.execute<InventoryRow[]>(
      `SELECT instance_id, product_id, selected_variant_id, purchase_transaction_id, created_at
       FROM user_decoration_inventory WHERE user_id = ? AND purchase_transaction_id = ? LIMIT 1`,
      [userId, transactionId],
    );
    const instance = inventory[0];
    if (!instance) throw new AppError(500, 'PURCHASE_INTEGRITY_ERROR', 'The purchase exists but its inventory item is missing.');
    return { transactionId, productId: product.id, inventoryInstanceId: Number(instance.instance_id), balance };
  }
}

async function ensureAndLockWallet(connection: PoolConnection, userId: number): Promise<number> {
  await connection.execute(
    'INSERT INTO user_wallets (user_id, coin_balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)',
    [userId],
  );
  const [rows] = await connection.execute<WalletRow[]>(
    'SELECT coin_balance FROM user_wallets WHERE user_id = ? FOR UPDATE', [userId],
  );
  if (!rows[0]) throw new AppError(500, 'WALLET_UNAVAILABLE', 'The game wallet is unavailable.');
  const balance = Number(rows[0].coin_balance);
  if (!Number.isSafeInteger(balance) || balance < 0) throw new AppError(500, 'WALLET_INTEGRITY_ERROR', 'The game wallet balance is invalid.');
  return balance;
}

function toInventoryInstance(row: InventoryRow): DecorationInventoryInstance {
  return {
    instanceId: Number(row.instance_id),
    productId: row.product_id,
    selectedVariantId: row.selected_variant_id,
    purchaseTransactionId: Number(row.purchase_transaction_id),
    acquiredAt: asDate(row.created_at).toISOString(),
  };
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(`${value}Z`);
}

function asDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
