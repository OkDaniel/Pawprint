import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { catalogProduct, catalogProducts } from './catalog.js';
import { EconomyRepository } from './economyRepository.js';

const yarn = catalogProduct('decor_yarn_ball')!;
const requestId = '11111111-1111-4111-8111-111111111111';

function setup(balance = 1, failInventory = false) {
  const execute = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes('SELECT coin_balance')) return [[{ coin_balance: balance }]];
    if (sql.includes('SELECT id, amount, transaction_type')) return [[]];
    if (sql.includes('SELECT onboarding_completed_at')) return [[{ onboarding_completed_at: new Date() }]];
    if (sql.includes('INSERT INTO coin_transactions')) return [{ insertId: 40 }];
    if (sql.includes('INSERT INTO user_decoration_inventory')) {
      if (failInventory) throw new Error('inventory write failed');
      return [{ insertId: 90 }];
    }
    return [{ affectedRows: 1 }];
  });
  const connection = { beginTransaction: vi.fn(), execute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const pool = { getConnection: vi.fn(async () => connection) } as unknown as Pool;
  return { repository: new EconomyRepository(pool), connection, execute };
}

describe('EconomyRepository purchase transaction', () => {
  it('locks the wallet, charges catalog price, and creates one inventory instance atomically', async () => {
    const { repository, connection, execute } = setup();
    await expect(repository.purchase(7, yarn, requestId)).resolves.toEqual({
      transactionId: 40, productId: 'decor_yarn_ball', balance: 0, inventoryInstanceId: 90,
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [7]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO coin_transactions'), [7, -1, `purchase:${requestId}`, 'decor_yarn_ball']);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('rejects insufficient funds before writing ledger or ownership', async () => {
    const { repository, connection, execute } = setup(0);
    await expect(repository.purchase(7, yarn, requestId)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO coin_transactions'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('rolls back ledger, balance, and inventory together on an injected ownership failure', async () => {
    const { repository, connection } = setup(1, true);
    await expect(repository.purchase(7, yarn, requestId)).rejects.toThrow('inventory write failed');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
  it.each(catalogProducts.filter(product => product.kind==='decoration'))('purchases reviewed $id with its semantic default finish', async product => {
    const {repository,execute}=setup();
    await expect(repository.purchase(7,product,requestId)).resolves.toMatchObject({productId:product.id,balance:0});
    if(product.kind!=='decoration') throw new Error('Expected decoration');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_decoration_inventory'),[7,product.id,product.defaultVariantId,40]);
  });

  it.each([false,true])('rejects disabled/retired new purchases before charging (retired=%s)',async retired=>{
    const {repository,connection,execute}=setup();
    await expect(repository.purchase(7,{...yarn,purchasable:false,price:null,retired},requestId))
      .rejects.toMatchObject({code:'PRODUCT_NOT_PURCHASABLE'});
    expect(execute.mock.calls.some(([sql])=>String(sql).includes('INSERT INTO coin_transactions'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

});
