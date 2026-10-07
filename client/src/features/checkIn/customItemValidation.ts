type NamedLibraryItem = { name: string; category?: string };

export function findCustomItemDuplicate<T extends NamedLibraryItem>(items: T[], candidateName: string): T | undefined {
  const normalizedCandidate = normalizeCustomItemName(candidateName);
  if (!normalizedCandidate) return undefined;
  return items.find((item) => normalizeCustomItemName(item.name) === normalizedCandidate);
}

export function duplicateCustomItemMessage(item: NamedLibraryItem): string {
  const location = item.category ? ` under ${item.category}` : '';
  return `${item.name} already exists${location}. Select it from the list above instead.`;
}

function normalizeCustomItemName(value: string): string {
  return value.trim().toLocaleLowerCase();
}
