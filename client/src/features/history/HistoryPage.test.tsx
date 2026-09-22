// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HistoryPage } from './HistoryPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('HistoryPage Sleep grouping', () => {
  it('shows one independent daily Sleep card alongside multiple Check-Ins', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/check-ins') return json({ checkIns: [checkIn(1), checkIn(2)] });
      if (String(input) === '/api/sleep') return json({ sleepEntries: [{ id: 9, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: 450, qualityScore: 4 }] });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Sleep' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Sleep' })).toHaveLength(1);
    expect(screen.getByText('7h 30m')).toBeInTheDocument();
    expect(screen.getByText('Quality: Good (4/5)')).toBeInTheDocument();
    expect(screen.getAllByText('Mood: Good (4/5)')).toHaveLength(2);
  });

  it('does not render an empty Sleep card when no Sleep was logged', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input) === '/api/check-ins' ? { checkIns: [checkIn(1)] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await screen.findByText('Mood: Good (4/5)');
    expect(screen.queryByRole('heading', { name: 'Sleep' })).not.toBeInTheDocument();
  });

  it('requests a logical-date range and exposes an Edit link for each Check-In', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [checkIn(1)] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Edit' });
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/app/check-in/1/edit');
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '9/1/2026' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '09/15/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/check-ins?startDate=2026-09-01&endDate=2026-09-15', expect.anything()));
  });

  it('links a daily Sleep card to its own logical-date editor', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input) === '/api/check-ins' ? { checkIns: [] } : { sleepEntries: [{ id: 9, logicalDate: '2026-09-15', bedtime: null, wakeTime: null, durationMinutes: 360, qualityScore: null }] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/app/sleep/2026-09-15/edit');
  });

  it('rejects an impossible or reversed custom date range before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input) === '/api/check-ins' ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2/30/2026' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '9/22/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter real dates');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '9/23/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Start date must be');
  });
});

function checkIn(id: number) {
  return { id, occurredAt: `2026-09-15T1${id}:00:00.000Z`, logicalDate: '2026-09-15', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
