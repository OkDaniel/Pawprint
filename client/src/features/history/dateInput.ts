export function parseUserDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateTyping(value: string, inputType = 'insertText', caretAtEnd = true): string {
  if (inputType !== 'insertText' || !caretAtEnd) return value;
  const parts = value.split('/');
  if (parts.length === 1 && /^\d{2}$/.test(parts[0]!)) {
    const month = Number(parts[0]);
    return month <= 12 ? `${parts[0]}/` : `${parts[0]![0]}/${parts[0]![1]}/`;
  }
  if (parts.length === 1 && /^[2-9]$/.test(parts[0]!)) return `${parts[0]}/`;
  if (parts.length === 2 && /^\d{2}$/.test(parts[1]!)) return `${parts[0]}/${parts[1]}/`;
  if (parts.length === 2 && /^[4-9]$/.test(parts[1]!)) return `${parts[0]}/${parts[1]}/`;
  return value;
}
