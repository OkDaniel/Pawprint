import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../auth/authService.js';
import { CheckInService } from '../checkIns/checkInService.js';
import { EconomyRepository } from '../economy/economyRepository.js';
import { EconomyService } from '../economy/economyService.js';
import { RoomService } from '../room/roomService.js';
import { closeDatabasePool, getDatabasePool } from './pool.js';

const databaseDescribe = process.env.RUN_DB_INTEGRATION === '1' ? describe.sequential : describe.skip;
const now = new Date('2026-10-07T17:00:00.000Z');
const rewardsStartAt = '2026-10-01T00:00:00Z';
const runner = { enqueue: () => true };

databaseDescribe('Phase 3 disposable MariaDB integration', () => {
  const pool = getDatabasePool();
  const userIds: number[] = [];
  let userOne = 0;
  let userTwo = 0;
  let userOneYarnIds: number[] = [];
  let userTwoYarnId = 0;

  beforeAll(async () => {
    userOne = await createCompletedUser(`phase3_a_${randomUUID().slice(0, 12)}`);
    userTwo = await createCompletedUser(`phase3_b_${randomUUID().slice(0, 12)}`);
    userIds.push(userOne, userTwo);
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
    }
    await closeDatabasePool();
  });

  it('persists one parent/child/Sleep set for concurrent same-request creates and replays before deactivated-library validation', async () => {
    const service = new CheckInService(undefined, () => now, undefined, runner);
    const requestId = randomUUID();
    const input = {
      clientRequestId: requestId, mood: 4, feelingIds: [], pain: 0,
      symptoms: [], factors: [], sleep: { bedtime: '23:30', wakeTime: '07:00', qualityScore: 4 },
    };
    const results = await Promise.all(Array.from({ length: 5 }, () => service.create(userOne, input)));
    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(results.map(({ checkIn }) => checkIn.id)).size).toBe(1);
    const checkInId = results[0]!.checkIn.id;
    expect(await scalar('SELECT COUNT(*) AS count FROM check_ins WHERE user_id = ? AND client_request_id = ?', [userOne, requestId])).toBe(1);
    expect(await scalar('SELECT COUNT(*) AS count FROM check_in_moods WHERE check_in_id = ?', [checkInId])).toBe(1);
    expect(await scalar('SELECT COUNT(*) AS count FROM check_in_pain WHERE check_in_id = ?', [checkInId])).toBe(1);
    expect(await scalar('SELECT COUNT(*) AS count FROM sleep_entries WHERE user_id = ? AND logical_date = ?', [userOne, '2026-10-07'])).toBe(1);
    await expect(service.create(userOne, { ...input, mood: 5 })).rejects.toMatchObject({ code: 'CHECK_IN_REQUEST_CONFLICT' });

    const [feeling] = await pool.execute<ResultSetHeader>(
      `INSERT INTO feelings (name, is_builtin, created_by_user_id, is_active)
       VALUES ('Phase 3 replay feeling', FALSE, ?, TRUE)`, [userOne],
    );
    const replayInput = { ...input, clientRequestId: randomUUID(), feelingIds: [feeling.insertId] };
    const created = await service.create(userOne, replayInput);
    await pool.execute('UPDATE feelings SET is_active = FALSE WHERE id = ?', [feeling.insertId]);
    await expect(service.create(userOne, replayInput)).resolves.toMatchObject({ created: false, checkIn: { id: created.checkIn.id } });
  });

  it('grants exactly one daily coin, preserves it after Check-In deletion, and reconciles a missing recent reward once', async () => {
    const repository = new EconomyRepository(pool);
    const economy = new EconomyService(repository, rewardsStartAt, () => now);
    const metadata = { occurredAt: now, createdAt: now, hasClientRequestId: true };
    const rewards = await Promise.all(Array.from({ length: 5 }, () =>
      economy.grantDailyCheckInReward(userOne, '2026-10-07', metadata)));
    expect(rewards.filter((result) => result === 'granted')).toHaveLength(1);
    expect(await scalar(
      "SELECT COUNT(*) AS count FROM coin_transactions WHERE user_id = ? AND transaction_type = 'DAILY_CHECKIN_REWARD' AND logical_date = '2026-10-07'",
      [userOne],
    )).toBe(1);
    await pool.execute('DELETE FROM check_ins WHERE user_id = ? AND logical_date = ?', [userOne, '2026-10-07']);
    expect((await economy.wallet(userOne)).balance).toBe(1);

    const service = new CheckInService(undefined, () => now, undefined, runner);
    await service.create(userTwo, { clientRequestId: randomUUID(), mood: 3, feelingIds: [], symptoms: [], factors: [] });
    await expect(economy.syncRecentRewards(userTwo)).resolves.toMatchObject({ rewardsGranted: 1 });
    await expect(economy.syncRecentRewards(userTwo)).resolves.toMatchObject({ rewardsGranted: 0 });
  });

  it('serializes spending, replays purchases safely, and never double-charges or duplicates unique coats', async () => {
    const economy = new EconomyService(new EconomyRepository(pool));
    const grantRequest = randomUUID();
    const grant = await economy.devGrant(userOne, 5, grantRequest);
    await expect(economy.devGrant(userOne, 5, grantRequest)).resolves.toEqual(grant);
    expect(await scalar(
      "SELECT COUNT(*) AS count FROM coin_transactions WHERE user_id = ? AND transaction_type = 'DEV_GRANT' AND idempotency_key = ?",
      [userOne, `dev_grant:${grantRequest}`],
    )).toBe(1);
    const firstRequest = randomUUID();
    const first = await economy.purchase(userOne, 'decor_yarn_ball', firstRequest);
    const replay = await economy.purchase(userOne, 'decor_yarn_ball', firstRequest);
    expect(replay.transactionId).toBe(first.transactionId);
    await expect(economy.purchase(userOne, 'mochi-grey', firstRequest)).rejects.toMatchObject({ code: 'PURCHASE_REQUEST_CONFLICT' });
    const second = await economy.purchase(userOne, 'decor_yarn_ball', randomUUID());
    expect(second.inventoryInstanceId).not.toBe(first.inventoryInstanceId);
    userOneYarnIds = [first.inventoryInstanceId!, second.inventoryInstanceId!];
    await economy.purchase(userOne, 'mochi-grey', randomUUID());
    await expect(economy.purchase(userOne, 'mochi-grey', randomUUID())).rejects.toMatchObject({ code: 'COAT_ALREADY_OWNED' });

    await economy.devGrant(userTwo, 2, randomUUID());
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () =>
      economy.purchase(userTwo, 'decor_yarn_ball', randomUUID())));
    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(3);
    expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(2);
    expect((await economy.wallet(userTwo)).balance).toBe(0); // +1 reconciled reward, +2 grant, -3 purchases
    const inventory = await economy.inventory(userTwo);
    userTwoYarnId = inventory[0]!.instanceId;
    expect(inventory).toHaveLength(3);
    expect(await economy.verifyWalletIntegrity()).toEqual([]);
  });

  it('enforces owned variants/coats and atomically preserves the last valid complete floor layout', async () => {
    const economy = new EconomyService(new EconomyRepository(pool));
    const updated = await economy.updateInventoryVariant(userOne, userOneYarnIds[0]!, 'decor_yarn_ball_base');
    expect(updated.selectedVariantId).toBe('decor_yarn_ball_sage');
    await expect(economy.updateInventoryVariant(userOne, userOneYarnIds[0]!, 'decor_bowl_base'))
      .rejects.toMatchObject({ code: 'INVALID_DECORATION_VARIANT' });
    await expect(economy.updateInventoryVariant(userOne, userTwoYarnId, 'decor_yarn_ball_base'))
      .rejects.toMatchObject({ code: 'INVENTORY_INSTANCE_NOT_FOUND' });

    const auth = new AuthService();
    await expect(auth.updateCompanion(userOne, 'mochi-grey', 'Luna')).resolves.toMatchObject({ catAppearance: 'mochi-grey', catName: 'Luna' });
    await expect(auth.updateCompanion(userOne, 'mochi-orange', 'Luna')).rejects.toMatchObject({ code: 'CAT_COAT_NOT_OWNED' });

    const room = new RoomService();
    const valid = [
      { inventoryInstanceId: userOneYarnIds[0]!, gridU: 2, gridV: 2 },
      { inventoryInstanceId: userOneYarnIds[1]!, gridU: 5, gridV: 5 },
    ];
    await expect(room.saveFloorLayout(userOne, valid)).resolves.toHaveLength(2);
    await expect(room.saveFloorLayout(userOne, [
      { inventoryInstanceId: userOneYarnIds[0]!, gridU: 2, gridV: 2 },
      { inventoryInstanceId: userOneYarnIds[1]!, gridU: 2, gridV: 2 },
    ])).rejects.toMatchObject({ code: 'PLACEMENT_COLLISION' });
    expect(await room.floorLayout(userOne)).toEqual(expect.arrayContaining(valid.map((placement) => expect.objectContaining(placement))));
    await expect(room.saveFloorLayout(userOne, [{ inventoryInstanceId: userTwoYarnId, gridU: 4, gridV: 4 }]))
      .rejects.toMatchObject({ code: 'INVENTORY_NOT_OWNED' });
    await expect(room.saveFloorLayout(userOne, [])).resolves.toEqual([]);
  });

  it('reloads the complete UI loop and renders a changed finish at the same saved nodes', async () => {
    const economy = new EconomyService(new EconomyRepository(pool));
    const first = userOneYarnIds[0]!;
    const layout = [{ inventoryInstanceId: first, gridU: 4, gridV: 6 }];
    await new RoomService().saveFloorLayout(userOne, layout);
    expect((await economy.inventory(userOne)).filter(i => i.instanceId === first)).toHaveLength(1);
    expect(await economy.ownedCoats(userOne)).toEqual(['mochi-classic', 'mochi-grey']);
    expect(await new AuthService().currentUser(userOne)).toMatchObject({ catAppearance: 'mochi-grey' });
    expect(await new RoomService().floorLayout(userOne)).toEqual([expect.objectContaining(layout[0]!)]);
    await economy.updateInventoryVariant(userOne, first, 'decor_yarn_ball_red');
    expect(await new RoomService().floorLayout(userOne)).toEqual([{ ...layout[0]!, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_red' }]);
  });

  async function createCompletedUser(username: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (username, password_hash, cat_appearance_key, cat_name, onboarding_completed_at)
       VALUES (?, 'integration-only', 'mochi-classic', 'Mochi', CURRENT_TIMESTAMP)`, [username],
    );
    await pool.execute("INSERT INTO user_cat_coats (user_id, coat_id) VALUES (?, 'mochi-classic')", [result.insertId]);
    return result.insertId;
  }

  async function scalar(sql: string, values: unknown[]): Promise<number> {
    const [rows] = await pool.execute<Array<RowDataPacket & { count: number | string }>>(sql, values);
    return Number(rows[0]?.count ?? 0);
  }
});
