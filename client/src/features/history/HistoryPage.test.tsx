// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('HistoryPage Sleep grouping', () => {
  it('shows one independent daily Sleep card alongside multiple Check-Ins', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/check-ins') return json({ checkIns: [checkIn(1), checkIn(2)] });
      if (String(input) === '/api/sleep') return json({ sleepEntries: [{ id: 9, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: 450, qualityScore: 4 }] });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    render(<HistoryPage />);
    expect(await screen.findByRole('heading', { name: 'Sleep' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Sleep' })).toHaveLength(1);
    expect(screen.getByText('7h 30m')).toBeInTheDocument();
    expect(screen.getByText('Quality: Good (4/5)')).toBeInTheDocument();
    expect(screen.getAllByText('Mood: Good (4/5)')).toHaveLength(2);
  });

  it('does not render an empty Sleep card when no Sleep was logged', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input) === '/api/check-ins' ? { checkIns: [checkIn(1)] } : { sleepEntries: [] }));
    render(<HistoryPage />);
    await screen.findByText('Mood: Good (4/5)');
    expect(screen.queryByRole('heading', { name: 'Sleep' })).not.toBeInTheDocument();
  });
});

function checkIn(id: number) {
  return { id, occurredAt: `2026-09-15T1${id}:00:00.000Z`, logicalDate: '2026-09-15', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
