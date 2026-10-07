export type ParsedTwelveHourTime = {
  hour: number;
  minute: number;
};

export function parseTwelveHourTime(value: string): ParsedTwelveHourTime | null {
  const match = /^(1[0-2]|[1-9]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function formatCompactSleepTime(value: string, inputType = 'insertText'): string {
  if (!inputType.startsWith('insert')) return value;
  if (!/^\d*:?[\d]*$/.test(value) || (value.match(/:/g)?.length ?? 0) > 1) return value;

  const digits = value.replace(':', '');
  if (digits.length === 3 && !value.includes(':')) return `${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return value;
}
