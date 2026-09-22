import { describe, expect, it } from 'vitest';
import { formatDateTyping, parseUserDate } from './dateInput';

describe('parseUserDate', () => {
  it.each([
    ['1/5/2026', '2026-01-05'],
    ['01/05/2026', '2026-01-05'],
    ['9/22/2026', '2026-09-22'],
    ['09/22/2026', '2026-09-22'],
  ])('normalizes %s to %s', (input, expected) => expect(parseUserDate(input)).toBe(expected));

  it.each(['2/30/2026', '13/5/2026', '9/31/2026', '2026-09-22'])('rejects invalid date %s', (input) => expect(parseUserDate(input)).toBeNull());
});

describe('formatDateTyping', () => {
  it.each([
    ['9', '9/'],
    ['09', '09/'],
    ['1/5', '1/5/'],
    ['1/05', '1/05/'],
  ])('adds a helpful separator to %s', (input, expected) => expect(formatDateTyping(input)).toBe(expected));

  it('does not alter paste, backspace, or middle edits', () => {
    expect(formatDateTyping('1/5/2026', 'insertFromPaste')).toBe('1/5/2026');
    expect(formatDateTyping('1/5', 'deleteContentBackward')).toBe('1/5');
    expect(formatDateTyping('1/5/2026', 'insertText', false)).toBe('1/5/2026');
  });
});
