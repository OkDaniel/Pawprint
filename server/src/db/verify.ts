import { closeDatabasePool, getDatabasePool } from './pool.js';

async function verify(): Promise<void> {
  const [tables] = await getDatabasePool().query('SHOW TABLES');
  const [factors] = await getDatabasePool().query('SELECT COUNT(*) AS built_in_factors FROM factors WHERE is_builtin = TRUE');
  const [feelings] = await getDatabasePool().query('SELECT COUNT(*) AS built_in_feelings FROM feelings WHERE is_builtin = TRUE');
  const [symptoms] = await getDatabasePool().query('SELECT category, COUNT(*) AS built_in_symptoms FROM symptoms WHERE is_builtin = TRUE GROUP BY category ORDER BY category');
  const [intensity] = await getDatabasePool().query("SELECT IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'check_in_factors' AND COLUMN_NAME = 'intensity'");
  const [factorPreferences] = await getDatabasePool().query("SELECT COUNT(*) AS factor_preference_columns FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_factor_preferences'");
  console.log('Tables:', tables);
  console.log('Built-in factors:', factors);
  console.log('Built-in feelings:', feelings);
  console.log('Built-in symptoms:', symptoms);
  console.log('Factor intensity column:', intensity);
  console.log('Factor preference columns:', factorPreferences);
}

verify().catch((error: unknown) => {
  console.error('Database verification failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
