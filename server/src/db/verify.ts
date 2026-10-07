import { closeDatabasePool, getDatabasePool } from './pool.js';

async function verify(): Promise<void> {
  const [tables] = await getDatabasePool().query('SHOW TABLES');
  const [factors] = await getDatabasePool().query('SELECT COUNT(*) AS built_in_factors FROM factors WHERE is_builtin = TRUE');
  const [feelings] = await getDatabasePool().query('SELECT COUNT(*) AS built_in_feelings FROM feelings WHERE is_builtin = TRUE');
  const [symptoms] = await getDatabasePool().query('SELECT category, COUNT(*) AS built_in_symptoms FROM symptoms WHERE is_builtin = TRUE GROUP BY category ORDER BY category');
  const [intensity] = await getDatabasePool().query("SELECT IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'check_in_factors' AND COLUMN_NAME = 'intensity'");
  const [factorPreferences] = await getDatabasePool().query("SELECT COUNT(*) AS factor_preference_columns FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_factor_preferences'");
  const [sleepColumns] = await getDatabasePool().query("SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sleep_entries' ORDER BY ORDINAL_POSITION");
  const [sleepUnique] = await getDatabasePool().query("SELECT COUNT(*) AS unique_sleep_keys FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sleep_entries' AND INDEX_NAME = 'uq_sleep_user_logical_date'");
  const [sleepForeignKey] = await getDatabasePool().query("SELECT REFERENCED_TABLE_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sleep_entries' AND CONSTRAINT_NAME = 'fk_sleep_entries_user'");
  const [sleepChecks] = await getDatabasePool().query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sleep_entries' AND CONSTRAINT_TYPE = 'CHECK' ORDER BY CONSTRAINT_NAME");
  const [catAppearance] = await getDatabasePool().query("SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cat_appearance_key'");
  const [catAppearanceCheck] = await getDatabasePool().query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'chk_users_cat_appearance'");
  const [onboardingColumns] = await getDatabasePool().query("SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('cat_name', 'onboarding_completed_at') ORDER BY ORDINAL_POSITION");
  const [onboardingUsers] = await getDatabasePool().query('SELECT COUNT(*) AS users, SUM(onboarding_completed_at IS NOT NULL) AS completed_users FROM users');
  console.log('Tables:', tables);
  console.log('Built-in factors:', factors);
  console.log('Built-in feelings:', feelings);
  console.log('Built-in symptoms:', symptoms);
  console.log('Factor intensity column:', intensity);
  console.log('Factor preference columns:', factorPreferences);
  console.log('Sleep columns:', sleepColumns);
  console.log('Sleep unique-key columns:', sleepUnique);
  console.log('Sleep user foreign key:', sleepForeignKey);
  console.log('Sleep check constraints:', sleepChecks);
  console.log('User cat appearance column:', catAppearance);
  console.log('User cat appearance check:', catAppearanceCheck);
  console.log('User onboarding columns:', onboardingColumns);
  console.log('User onboarding completion:', onboardingUsers);
}

verify().catch((error: unknown) => {
  console.error('Database verification failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
