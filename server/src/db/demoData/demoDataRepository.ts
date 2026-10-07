import { symptomCategories, trackingLibraryStarterSlugs, type SymptomCategory } from '@capstone/shared';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  DEMO_CAT_APPEARANCE,
  DEMO_CAT_NAME,
  DEMO_HISTORY_DAYS,
  DEMO_USERNAME,
  type DemoDataScenario,
} from './demoDataGenerator.js';

interface DemoUserRow extends RowDataPacket {
  id: number;
  username: string;
  cat_appearance_key?: string;
  cat_name?: string;
  onboarding_completed_at?: Date | null;
}

interface LibraryRow extends RowDataPacket {
  id: number;
  slug: string | null;
  category?: SymptomCategory;
}

interface CountRow extends RowDataPacket { count: number | string }
interface RangeRow extends RowDataPacket { minimum: Date | string | null; maximum: Date | string | null; days: number | string }
interface FactorFrequencyRow extends RowDataPacket { slug: string; occurrences: number | string }
interface SleepVerificationRow extends RowDataPacket {
  logical_date: Date | string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality_score: number | null;
}

interface ProtectedUserRow extends RowDataPacket {
  id: number | string;
  username: string;
  password_hash: string;
  cat_appearance_key: string;
  cat_name: string;
  onboarding_completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  check_ins: number | string;
  mood_rows: number | string;
  pain_rows: number | string;
  feeling_links: number | string;
  symptom_entries: number | string;
  factor_links: number | string;
  sleep_entries: number | string;
  feeling_preferences: number | string;
  symptom_preferences: number | string;
  factor_preferences: number | string;
  custom_feelings: number | string;
  custom_symptoms: number | string;
  custom_factors: number | string;
}

export interface OwnedDataCounts {
  checkIns: number;
  moodRows: number;
  painRows: number;
  feelingLinks: number;
  symptomEntries: number;
  factorLinks: number;
  sleepEntries: number;
  feelingPreferences: number;
  symptomPreferences: number;
  factorPreferences: number;
}

interface ProtectedUserSnapshot {
  username: string;
  fingerprint: string;
  counts: OwnedDataCounts;
}

export interface DemoSeedSummary {
  userId: number;
  startLogicalDate: string;
  endLogicalDate: string;
  daysRepresented: number;
  totalDays: number;
  checkIns: number;
  sleepEntries: number;
  moodRows: number;
  painRows: number;
  symptomEntries: number;
  feelingLinks: number;
  factorLinks: number;
  multipleCheckInDays: number;
  protectedUsersVerified: number;
  okidanielCounts: { before: OwnedDataCounts; after: OwnedDataCounts } | null;
}

interface Libraries {
  feelings: LibraryRow[];
  symptoms: LibraryRow[];
  factors: LibraryRow[];
}

export async function seedDemoData(pool: Pool, scenario: DemoDataScenario, passwordHash: string): Promise<DemoSeedSummary> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const protectedBefore = await snapshotProtectedUsers(connection);
    await deleteExactDemoUser(connection);
    const libraries = await loadLibraries(connection);
    assertRequiredSlugsExist(scenario, libraries);

    const userId = await createDemoUser(connection, passwordHash);
    await writePreferenceSnapshots(connection, userId, libraries);
    await writeScenario(connection, userId, scenario, libraries);

    const summary = await verifyPersistedScenario(connection, userId, scenario, libraries);
    const protectedAfter = await snapshotProtectedUsers(connection);
    assertProtectedUsersUnchanged(protectedBefore, protectedAfter);
    summary.protectedUsersVerified = protectedAfter.length;
    const beforeOkidaniel = protectedBefore.find(({ username }) => username === 'okidaniel');
    const afterOkidaniel = protectedAfter.find(({ username }) => username === 'okidaniel');
    summary.okidanielCounts = beforeOkidaniel && afterOkidaniel
      ? { before: beforeOkidaniel.counts, after: afterOkidaniel.counts }
      : null;

    await connection.commit();
    return summary;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteExactDemoUser(connection: PoolConnection): Promise<void> {
  if (DEMO_USERNAME !== 'pawprint_demo') throw new Error('Refusing demo reset because the protected username constant changed.');
  const [rows] = await connection.execute<DemoUserRow[]>(
    'SELECT id, username FROM users WHERE username = ? FOR UPDATE', [DEMO_USERNAME],
  );
  if (rows.length > 1) throw new Error('Refusing demo reset because multiple demo users were found.');
  const existing = rows[0];
  if (!existing) return;
  if (existing.username !== DEMO_USERNAME) throw new Error('Refusing demo reset because the selected username did not match exactly.');
  const [result] = await connection.execute<ResultSetHeader>(
    'DELETE FROM users WHERE id = ? AND username = ?', [Number(existing.id), DEMO_USERNAME],
  );
  if (result.affectedRows !== 1) throw new Error('The exact demo user could not be reset safely.');
}

async function createDemoUser(connection: PoolConnection, passwordHash: string): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO users
       (username, password_hash, cat_appearance_key, cat_name, onboarding_completed_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [DEMO_USERNAME, passwordHash, DEMO_CAT_APPEARANCE, DEMO_CAT_NAME],
  );
  return result.insertId;
}

async function loadLibraries(connection: PoolConnection): Promise<Libraries> {
  const [feelings] = await connection.execute<LibraryRow[]>(
    'SELECT id, slug FROM feelings WHERE is_builtin = TRUE AND is_active = TRUE ORDER BY id',
  );
  const [symptoms] = await connection.execute<LibraryRow[]>(
    'SELECT id, slug, category FROM symptoms WHERE is_builtin = TRUE AND is_active = TRUE ORDER BY category, id',
  );
  const [factors] = await connection.execute<LibraryRow[]>(
    'SELECT id, slug FROM factors WHERE is_builtin = TRUE AND is_active = TRUE ORDER BY id',
  );
  return { feelings, symptoms, factors };
}

function assertRequiredSlugsExist(scenario: DemoDataScenario, libraries: Libraries): void {
  const requiredFeelings = new Set([
    ...trackingLibraryStarterSlugs.feelings,
    ...scenario.checkIns.flatMap(({ feelingSlugs }) => feelingSlugs),
  ]);
  const requiredSymptoms = new Set([
    ...symptomCategories.flatMap((category) => trackingLibraryStarterSlugs.symptoms[category]),
    ...scenario.checkIns.flatMap(({ symptoms }) => symptoms.map(({ slug }) => slug)),
  ]);
  const requiredFactors = new Set([
    ...trackingLibraryStarterSlugs.factors,
    ...scenario.checkIns.flatMap(({ factors }) => factors.map(({ slug }) => slug)),
  ]);
  assertSlugSet('Feeling', requiredFeelings, libraries.feelings);
  assertSlugSet('Symptom', requiredSymptoms, libraries.symptoms);
  assertSlugSet('Factor', requiredFactors, libraries.factors);
}

function assertSlugSet(kind: string, required: Set<string>, rows: LibraryRow[]): void {
  const available = new Set(rows.map(({ slug }) => slug).filter((slug): slug is string => slug !== null));
  const missing = [...required].filter((slug) => !available.has(slug));
  if (missing.length > 0) {
    throw new Error(`${kind} demo-data slugs are missing from the active built-in library: ${missing.join(', ')}. Run npm run db:seed first.`);
  }
}

async function writePreferenceSnapshots(connection: PoolConnection, userId: number, libraries: Libraries): Promise<void> {
  await insertPreferences(
    connection, 'user_feeling_preferences', 'feeling_id', userId,
    libraries.feelings, new Set<string>(trackingLibraryStarterSlugs.feelings),
  );
  for (const category of symptomCategories) {
    await insertPreferences(
      connection, 'user_symptom_preferences', 'symptom_id', userId,
      libraries.symptoms.filter((item) => item.category === category),
      new Set<string>(trackingLibraryStarterSlugs.symptoms[category]),
    );
  }
  await insertPreferences(
    connection, 'user_factor_preferences', 'factor_id', userId,
    libraries.factors, new Set<string>(trackingLibraryStarterSlugs.factors),
  );
}

async function insertPreferences(
  connection: PoolConnection,
  table: 'user_feeling_preferences' | 'user_symptom_preferences' | 'user_factor_preferences',
  idColumn: 'feeling_id' | 'symptom_id' | 'factor_id',
  userId: number,
  items: LibraryRow[],
  pinnedSlugs: Set<string>,
): Promise<void> {
  const ordered = [
    ...items.filter(({ slug }) => slug !== null && pinnedSlugs.has(slug)),
    ...items.filter(({ slug }) => slug === null || !pinnedSlugs.has(slug)),
  ];
  for (const [index, item] of ordered.entries()) {
    await connection.execute(
      `INSERT INTO ${table} (user_id, ${idColumn}, is_pinned, display_order) VALUES (?, ?, ?, ?)`,
      [userId, Number(item.id), item.slug !== null && pinnedSlugs.has(item.slug), index],
    );
  }
}

async function writeScenario(connection: PoolConnection, userId: number, scenario: DemoDataScenario, libraries: Libraries): Promise<void> {
  const feelingIds = libraryIdMap(libraries.feelings);
  const symptomIds = libraryIdMap(libraries.symptoms);
  const factorIds = libraryIdMap(libraries.factors);

  for (const checkIn of scenario.checkIns) {
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO check_ins (user_id, occurred_at, logical_date) VALUES (?, ?, ?)',
      [userId, checkIn.occurredAt, checkIn.logicalDate],
    );
    const checkInId = result.insertId;
    await connection.execute(
      'INSERT INTO check_in_moods (check_in_id, mood_score) VALUES (?, ?)', [checkInId, checkIn.mood],
    );
    for (const slug of checkIn.feelingSlugs) {
      await connection.execute(
        'INSERT INTO check_in_feelings (check_in_id, feeling_id) VALUES (?, ?)',
        [checkInId, requiredId(feelingIds, 'Feeling', slug)],
      );
    }
    if (checkIn.pain !== null) {
      await connection.execute(
        'INSERT INTO check_in_pain (check_in_id, pain_score) VALUES (?, ?)', [checkInId, checkIn.pain],
      );
    }
    for (const symptom of checkIn.symptoms) {
      await connection.execute(
        'INSERT INTO symptom_entries (check_in_id, symptom_id, severity) VALUES (?, ?, ?)',
        [checkInId, requiredId(symptomIds, 'Symptom', symptom.slug), symptom.severity],
      );
    }
    for (const factor of checkIn.factors) {
      await connection.execute(
        'INSERT INTO check_in_factors (check_in_id, factor_id, intensity) VALUES (?, ?, ?)',
        [checkInId, requiredId(factorIds, 'Factor', factor.slug), factor.intensity],
      );
    }
  }

  for (const sleep of scenario.sleepEntries) {
    await connection.execute(
      `INSERT INTO sleep_entries
         (user_id, logical_date, bedtime, wake_time, duration_minutes, quality_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, sleep.logicalDate, sleep.bedtime, sleep.wakeTime, sleep.durationMinutes, sleep.qualityScore],
    );
  }
}

function libraryIdMap(rows: LibraryRow[]): Map<string, number> {
  return new Map(rows.flatMap(({ id, slug }) => slug === null ? [] : [[slug, Number(id)] as const]));
}

function requiredId(ids: Map<string, number>, kind: string, slug: string): number {
  const id = ids.get(slug);
  if (id === undefined) throw new Error(`${kind} slug ${slug} became unavailable during demo generation.`);
  return id;
}

async function verifyPersistedScenario(
  connection: PoolConnection,
  userId: number,
  scenario: DemoDataScenario,
  libraries: Libraries,
): Promise<DemoSeedSummary> {
  const [demoUsers] = await connection.execute<DemoUserRow[]>(
    `SELECT id, username, cat_appearance_key, cat_name, onboarding_completed_at
     FROM users WHERE username = ?`, [DEMO_USERNAME],
  );
  assert(demoUsers.length === 1, 'Expected exactly one pawprint_demo user after seeding.');
  const demoUser = demoUsers[0]!;
  assert(Number(demoUser.id) === userId, 'The verified demo user ID did not match the created user.');
  assert(demoUser.cat_appearance_key === DEMO_CAT_APPEARANCE, 'The demo appearance was not persisted correctly.');
  assert(demoUser.cat_name === DEMO_CAT_NAME, 'The demo companion name was not persisted correctly.');
  assert(demoUser.onboarding_completed_at != null, 'The demo user is not onboarding-complete.');

  const checkIns = await count(connection, 'SELECT COUNT(*) AS count FROM check_ins WHERE user_id = ?', [userId]);
  const moodRows = await count(connection, 'SELECT COUNT(*) AS count FROM check_in_moods m JOIN check_ins ci ON ci.id = m.check_in_id WHERE ci.user_id = ?', [userId]);
  const painRows = await count(connection, 'SELECT COUNT(*) AS count FROM check_in_pain p JOIN check_ins ci ON ci.id = p.check_in_id WHERE ci.user_id = ?', [userId]);
  const feelingLinks = await count(connection, 'SELECT COUNT(*) AS count FROM check_in_feelings f JOIN check_ins ci ON ci.id = f.check_in_id WHERE ci.user_id = ?', [userId]);
  const symptomEntries = await count(connection, 'SELECT COUNT(*) AS count FROM symptom_entries s JOIN check_ins ci ON ci.id = s.check_in_id WHERE ci.user_id = ?', [userId]);
  const factorLinks = await count(connection, 'SELECT COUNT(*) AS count FROM check_in_factors f JOIN check_ins ci ON ci.id = f.check_in_id WHERE ci.user_id = ?', [userId]);
  const sleepEntries = await count(connection, 'SELECT COUNT(*) AS count FROM sleep_entries WHERE user_id = ?', [userId]);
  const [rangeRows] = await connection.execute<RangeRow[]>(
    'SELECT MIN(logical_date) AS minimum, MAX(logical_date) AS maximum, COUNT(DISTINCT logical_date) AS days FROM check_ins WHERE user_id = ?',
    [userId],
  );
  const range = rangeRows[0]!;
  const daysRepresented = Number(range.days);
  const multipleCheckInDays = await count(connection,
    'SELECT COUNT(*) AS count FROM (SELECT logical_date FROM check_ins WHERE user_id = ? GROUP BY logical_date HAVING COUNT(*) > 1) grouped',
    [userId],
  );

  assert(checkIns === scenario.checkIns.length, 'Persisted Check-In count did not match the generated scenario.');
  assert(moodRows === checkIns, 'Every demo Check-In must have exactly one Mood row.');
  assert(sleepEntries === scenario.sleepEntries.length, 'Persisted Sleep count did not match the generated scenario.');
  assert(asDateString(range.minimum) === scenario.startLogicalDate, 'The first represented Check-In date is outside the expected range.');
  assert(asDateString(range.maximum) === scenario.endLogicalDate, 'The last represented Check-In date is outside the expected range.');
  assert(daysRepresented < DEMO_HISTORY_DAYS, 'The scenario must contain intentionally missing Check-In days.');
  assert(multipleCheckInDays > 0, 'The scenario must contain dates with multiple Check-Ins.');

  const invalidCheckIns = await count(connection,
    `SELECT COUNT(*) AS count FROM check_ins ci
     LEFT JOIN check_in_moods m ON m.check_in_id = ci.id
     LEFT JOIN check_in_pain p ON p.check_in_id = ci.id
     WHERE ci.user_id = ? AND (
       ci.logical_date < ? OR ci.logical_date > ? OR m.mood_score IS NULL OR m.mood_score NOT BETWEEN 1 AND 5
       OR (p.pain_score IS NOT NULL AND p.pain_score NOT BETWEEN 0 AND 10)
     )`,
    [userId, scenario.startLogicalDate, scenario.endLogicalDate],
  );
  assert(invalidCheckIns === 0, 'The demo has an invalid date, Mood, or Pain value.');

  const missingPain = checkIns - painRows;
  const zeroPain = await count(connection,
    'SELECT COUNT(*) AS count FROM check_in_pain p JOIN check_ins ci ON ci.id = p.check_in_id WHERE ci.user_id = ? AND p.pain_score = 0', [userId],
  );
  const missingSymptoms = await count(connection,
    'SELECT COUNT(*) AS count FROM check_ins ci WHERE ci.user_id = ? AND NOT EXISTS (SELECT 1 FROM symptom_entries s WHERE s.check_in_id = ci.id)', [userId],
  );
  const zeroSymptoms = await count(connection,
    'SELECT COUNT(*) AS count FROM symptom_entries s JOIN check_ins ci ON ci.id = s.check_in_id WHERE ci.user_id = ? AND s.severity = 0', [userId],
  );
  assert(missingPain > 0 && zeroPain > 0, 'The demo must include missing and explicit-zero Pain examples.');
  assert(missingSymptoms > 0 && zeroSymptoms > 0, 'The demo must include missing and explicit-zero Symptom examples.');

  const invalidChildren = await count(connection,
    `SELECT COUNT(*) AS count FROM (
       SELECT cif.check_in_id FROM check_in_feelings cif
         JOIN check_ins ci ON ci.id = cif.check_in_id
         LEFT JOIN feelings item ON item.id = cif.feeling_id
         WHERE ci.user_id = ? AND (item.id IS NULL OR item.is_builtin <> TRUE OR item.is_active <> TRUE)
       UNION ALL
       SELECT se.check_in_id FROM symptom_entries se
         JOIN check_ins ci ON ci.id = se.check_in_id
         LEFT JOIN symptoms item ON item.id = se.symptom_id
         WHERE ci.user_id = ? AND (item.id IS NULL OR item.is_builtin <> TRUE OR item.is_active <> TRUE OR se.severity NOT BETWEEN 0 AND 4)
       UNION ALL
       SELECT cif.check_in_id FROM check_in_factors cif
         JOIN check_ins ci ON ci.id = cif.check_in_id
         LEFT JOIN factors item ON item.id = cif.factor_id
         WHERE ci.user_id = ? AND (item.id IS NULL OR item.is_builtin <> TRUE OR item.is_active <> TRUE OR cif.intensity NOT BETWEEN 1 AND 3)
     ) invalid`,
    [userId, userId, userId],
  );
  assert(invalidChildren === 0, 'The demo contains an inaccessible library ID or invalid child value.');

  const invalidSleep = await count(connection,
    `SELECT COUNT(*) AS count FROM sleep_entries
     WHERE user_id = ? AND (
       logical_date < ? OR logical_date > ?
       OR duration_minutes NOT BETWEEN 1 AND 1440
       OR (quality_score IS NOT NULL AND quality_score NOT BETWEEN 1 AND 5)
     )`,
    [userId, scenario.startLogicalDate, scenario.endLogicalDate],
  );
  const duplicateSleepDates = await count(connection,
    'SELECT COUNT(*) AS count FROM (SELECT logical_date FROM sleep_entries WHERE user_id = ? GROUP BY logical_date HAVING COUNT(*) > 1) duplicates', [userId],
  );
  assert(invalidSleep === 0 && duplicateSleepDates === 0, 'The demo contains invalid or duplicate daily Sleep rows.');
  await assertSleepMatchesScenario(connection, userId, scenario);

  const [factorFrequencies] = await connection.execute<FactorFrequencyRow[]>(
    `SELECT f.slug, COUNT(*) AS occurrences FROM check_in_factors cif
     JOIN check_ins ci ON ci.id = cif.check_in_id
     JOIN factors f ON f.id = cif.factor_id
     WHERE ci.user_id = ? GROUP BY f.id, f.slug ORDER BY occurrences DESC, f.slug`, [userId],
  );
  assert(factorFrequencies.filter(({ occurrences }) => Number(occurrences) >= 8).length >= 3,
    'At least three demo Factors must recur eight or more times for analytics testing.');
  await assertPreferenceSnapshots(connection, userId, libraries);

  return {
    userId,
    startLogicalDate: scenario.startLogicalDate,
    endLogicalDate: scenario.endLogicalDate,
    daysRepresented,
    totalDays: DEMO_HISTORY_DAYS,
    checkIns,
    sleepEntries,
    moodRows,
    painRows,
    symptomEntries,
    feelingLinks,
    factorLinks,
    multipleCheckInDays,
    protectedUsersVerified: 0,
    okidanielCounts: null,
  };
}

async function assertSleepMatchesScenario(connection: PoolConnection, userId: number, scenario: DemoDataScenario): Promise<void> {
  const [rows] = await connection.execute<SleepVerificationRow[]>(
    `SELECT logical_date, TIME_FORMAT(bedtime, '%H:%i') AS bedtime,
       TIME_FORMAT(wake_time, '%H:%i') AS wake_time, duration_minutes, quality_score
     FROM sleep_entries WHERE user_id = ? ORDER BY logical_date`, [userId],
  );
  const actual = rows.map((row) => ({
    logicalDate: asDateString(row.logical_date),
    bedtime: row.bedtime,
    wakeTime: row.wake_time,
    durationMinutes: Number(row.duration_minutes),
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
  }));
  assert(JSON.stringify(actual) === JSON.stringify(scenario.sleepEntries), 'Persisted Sleep values did not match the generated scenario.');
}

async function assertPreferenceSnapshots(connection: PoolConnection, userId: number, libraries: Libraries): Promise<void> {
  const feelingPreferences = await count(connection, 'SELECT COUNT(*) AS count FROM user_feeling_preferences WHERE user_id = ?', [userId]);
  const symptomPreferences = await count(connection, 'SELECT COUNT(*) AS count FROM user_symptom_preferences WHERE user_id = ?', [userId]);
  const factorPreferences = await count(connection, 'SELECT COUNT(*) AS count FROM user_factor_preferences WHERE user_id = ?', [userId]);
  assert(feelingPreferences === libraries.feelings.length, 'Feeling preference snapshot is incomplete.');
  assert(symptomPreferences === libraries.symptoms.length, 'Symptom preference snapshot is incomplete.');
  assert(factorPreferences === libraries.factors.length, 'Factor preference snapshot is incomplete.');

  const pinnedFeelings = await pinnedSlugs(connection,
    'SELECT f.slug FROM user_feeling_preferences p JOIN feelings f ON f.id = p.feeling_id WHERE p.user_id = ? AND p.is_pinned = TRUE', userId);
  const pinnedSymptoms = await pinnedSlugs(connection,
    'SELECT s.slug FROM user_symptom_preferences p JOIN symptoms s ON s.id = p.symptom_id WHERE p.user_id = ? AND p.is_pinned = TRUE', userId);
  const pinnedFactors = await pinnedSlugs(connection,
    'SELECT f.slug FROM user_factor_preferences p JOIN factors f ON f.id = p.factor_id WHERE p.user_id = ? AND p.is_pinned = TRUE', userId);
  assertSameSlugs(pinnedFeelings, trackingLibraryStarterSlugs.feelings, 'Feeling');
  assertSameSlugs(pinnedSymptoms, symptomCategories.flatMap((category) => trackingLibraryStarterSlugs.symptoms[category]), 'Symptom');
  assertSameSlugs(pinnedFactors, trackingLibraryStarterSlugs.factors, 'Factor');
}

async function pinnedSlugs(connection: PoolConnection, sql: string, userId: number): Promise<string[]> {
  const [rows] = await connection.execute<Array<RowDataPacket & { slug: string }>>(sql, [userId]);
  return rows.map(({ slug }) => slug);
}

function assertSameSlugs(actual: string[], expected: readonly string[], kind: string): void {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(JSON.stringify(actualSorted) === JSON.stringify(expectedSorted), `${kind} pinned preferences do not match the canonical starter set.`);
}

async function snapshotProtectedUsers(connection: PoolConnection): Promise<ProtectedUserSnapshot[]> {
  const [rows] = await connection.execute<ProtectedUserRow[]>(
    `SELECT u.id, u.username, u.password_hash, u.cat_appearance_key, u.cat_name,
       u.onboarding_completed_at, u.created_at, u.updated_at,
       (SELECT COUNT(*) FROM check_ins ci WHERE ci.user_id = u.id) AS check_ins,
       (SELECT COUNT(*) FROM check_in_moods m JOIN check_ins ci ON ci.id = m.check_in_id WHERE ci.user_id = u.id) AS mood_rows,
       (SELECT COUNT(*) FROM check_in_pain p JOIN check_ins ci ON ci.id = p.check_in_id WHERE ci.user_id = u.id) AS pain_rows,
       (SELECT COUNT(*) FROM check_in_feelings l JOIN check_ins ci ON ci.id = l.check_in_id WHERE ci.user_id = u.id) AS feeling_links,
       (SELECT COUNT(*) FROM symptom_entries s JOIN check_ins ci ON ci.id = s.check_in_id WHERE ci.user_id = u.id) AS symptom_entries,
       (SELECT COUNT(*) FROM check_in_factors l JOIN check_ins ci ON ci.id = l.check_in_id WHERE ci.user_id = u.id) AS factor_links,
       (SELECT COUNT(*) FROM sleep_entries s WHERE s.user_id = u.id) AS sleep_entries,
       (SELECT COUNT(*) FROM user_feeling_preferences p WHERE p.user_id = u.id) AS feeling_preferences,
       (SELECT COUNT(*) FROM user_symptom_preferences p WHERE p.user_id = u.id) AS symptom_preferences,
       (SELECT COUNT(*) FROM user_factor_preferences p WHERE p.user_id = u.id) AS factor_preferences,
       (SELECT COUNT(*) FROM feelings f WHERE f.created_by_user_id = u.id) AS custom_feelings,
       (SELECT COUNT(*) FROM symptoms s WHERE s.created_by_user_id = u.id) AS custom_symptoms,
       (SELECT COUNT(*) FROM factors f WHERE f.created_by_user_id = u.id) AS custom_factors
     FROM users u WHERE u.username <> ? ORDER BY u.id`,
    [DEMO_USERNAME],
  );
  return rows.map((row) => ({
    username: row.username,
    fingerprint: stableFingerprint(row),
    counts: toOwnedDataCounts(row),
  }));
}

function stableFingerprint(row: ProtectedUserRow): string {
  return JSON.stringify(Object.keys(row).sort().map((key) => {
    const value = row[key as keyof ProtectedUserRow];
    return [key, value instanceof Date ? value.toISOString() : String(value ?? '')];
  }));
}

function toOwnedDataCounts(row: ProtectedUserRow): OwnedDataCounts {
  return {
    checkIns: Number(row.check_ins), moodRows: Number(row.mood_rows), painRows: Number(row.pain_rows),
    feelingLinks: Number(row.feeling_links), symptomEntries: Number(row.symptom_entries), factorLinks: Number(row.factor_links),
    sleepEntries: Number(row.sleep_entries), feelingPreferences: Number(row.feeling_preferences),
    symptomPreferences: Number(row.symptom_preferences), factorPreferences: Number(row.factor_preferences),
  };
}

function assertProtectedUsersUnchanged(before: ProtectedUserSnapshot[], after: ProtectedUserSnapshot[]): void {
  assert(JSON.stringify(before) === JSON.stringify(after), 'A non-demo user changed during demo-data generation; the transaction was rolled back.');
}

async function count(connection: PoolConnection, sql: string, values: Array<string | number>): Promise<number> {
  const [rows] = await connection.execute<CountRow[]>(sql, values);
  return Number(rows[0]?.count ?? 0);
}

function asDateString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
