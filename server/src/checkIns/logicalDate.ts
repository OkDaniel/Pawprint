export const LOGICAL_DAY_CUTOFF_HOUR = 4;

// UTC is the temporary application timezone until user-profile timezones are added.
export function getLogicalDate(date: Date, cutoffHour = LOGICAL_DAY_CUTOFF_HOUR): string {
  const shifted = new Date(date.getTime() - cutoffHour * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
