// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HistoryPage } from './HistoryPage';

const originalShowPicker = HTMLInputElement.prototype.showPicker;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-29T12:00:00'));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (originalShowPicker) Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: originalShowPicker });
  else delete (HTMLInputElement.prototype as { showPicker?: () => void }).showPicker;
});

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

  it('synchronizes native calendar choices with the natural date fields and normalized query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.change(document.getElementById('history-start-date-picker')!, { target: { value: '2026-09-02' } });
    fireEvent.change(document.getElementById('history-end-date-picker')!, { target: { value: '2026-09-22' } });
    expect(screen.getByLabelText('Start date')).toHaveValue('9/2/2026');
    expect(screen.getByLabelText('End date')).toHaveValue('9/22/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/check-ins?startDate=2026-09-02&endDate=2026-09-22', expect.anything()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sleep?startDate=2026-09-02&endDate=2026-09-22', expect.anything()));
  });

  it('groups each natural date field with its own same-sized calendar control and local-today maximum', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await screen.findByText('No history yet. Your saved entries will appear here.');
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    const startGroup = document.querySelector<HTMLElement>('[data-date-control="history-start-date"]')!;
    const endGroup = document.querySelector<HTMLElement>('[data-date-control="history-end-date"]')!;
    expect(within(startGroup).getByLabelText('Start date')).toBeInTheDocument();
    expect(within(startGroup).getByRole('button', { name: 'Choose start date from calendar' })).toBeInTheDocument();
    expect(within(endGroup).getByLabelText('End date')).toBeInTheDocument();
    expect(within(endGroup).getByRole('button', { name: 'Choose end date from calendar' })).toBeInTheDocument();
    expect(document.getElementById('history-start-date-picker')).toHaveAttribute('max', '2026-09-29');
    expect(document.getElementById('history-end-date-picker')).toHaveAttribute('max', '2026-09-29');
  });

  it('opens each native calendar picker exactly once from one calendar-button click', async () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: showPicker });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await screen.findByText('No history yet. Your saved entries will appear here.');
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose start date from calendar' }));
    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(showPicker.mock.instances[0]).toBe(document.getElementById('history-start-date-picker'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose end date from calendar' }));
    expect(showPicker).toHaveBeenCalledTimes(2);
    expect(showPicker.mock.instances[1]).toBe(document.getElementById('history-end-date-picker'));
  });

  it('falls back to focusing and clicking the native input when showPicker is unsupported', async () => {
    delete (HTMLInputElement.prototype as { showPicker?: () => void }).showPicker;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await screen.findByText('No history yet. Your saved entries will appear here.');
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    const nativeInput = document.getElementById('history-start-date-picker') as HTMLInputElement;
    const click = vi.spyOn(nativeInput, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose start date from calendar' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(nativeInput).toHaveFocus();
  });

  it('keeps preset ranges independent of the custom calendar controls', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: '7' } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => /^\/api\/check-ins\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}$/.test(String(input)))).toBe(true));
    expect(screen.queryByLabelText('Choose start date from calendar')).not.toBeInTheDocument();
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

  it('accepts today and past dates in a custom range', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '9/1/2026' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '9/29/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/check-ins?startDate=2026-09-01&endDate=2026-09-29', expect.anything()));
  });

  it.each([
    ['Start date', '9/30/2026', '9/29/2026', 'Start date cannot be in the future.'],
    ['End date', '9/1/2026', '9/30/2026', 'End date cannot be in the future.'],
  ] as const)('rejects a future %s without applying the range', async (_field, start, end, message) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => json(String(input).startsWith('/api/check-ins') ? { checkIns: [] } : { sleepEntries: [] }));
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: start } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: end } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function checkIn(id: number) {
  return { id, occurredAt: `2026-09-15T1${id}:00:00.000Z`, logicalDate: '2026-09-15', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
