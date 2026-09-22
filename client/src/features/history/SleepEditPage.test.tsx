// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SleepEditPage } from './SleepEditPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SleepEditPage', () => {
  it('prefills and updates the existing logical-date resource without creating a duplicate', async () => {
    let savedBody: unknown;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) !== '/api/sleep/2026-09-15') throw new Error(`Unexpected request: ${String(input)}`);
      if (init?.method === 'PUT') { savedBody = JSON.parse(String(init.body)); return json({ sleep: {} }); }
      return json({ sleep: { id: 8, logicalDate: '2026-09-15', bedtime: '00:50', wakeTime: '09:50', durationMinutes: 540, qualityScore: 3 } });
    });
    render(<MemoryRouter initialEntries={['/app/sleep/2026-09-15/edit']}><Routes>
      <Route path="/app/sleep/:logicalDate/edit" element={<SleepEditPage />} />
      <Route path="/app/history" element={<h1>History reached</h1>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByLabelText('Bedtime')).toHaveValue('12:50');
    expect(screen.getByLabelText('Estimated sleep duration')).toHaveTextContent('9h 0m');
    expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Sleep' }));
    expect(await screen.findByRole('heading', { name: 'History reached' })).toBeInTheDocument();
    expect(savedBody).toMatchObject({ bedtime: '00:50', wakeTime: '09:50', durationMinutes: 540, qualityScore: 3 });
    expect(fetchMock).toHaveBeenCalledWith('/api/sleep/2026-09-15', expect.objectContaining({ method: 'PUT' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('keeps time-only and quality-only edits valid', async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'PUT') { bodies.push(JSON.parse(String(init.body))); return json({ sleep: {} }); }
      return json({ sleep: { id: 8, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: null, qualityScore: null } });
    });
    render(<MemoryRouter initialEntries={['/app/sleep/2026-09-15/edit']}><Routes><Route path="/app/sleep/:logicalDate/edit" element={<SleepEditPage />} /><Route path="/app/history" element={<h1>Done</h1>} /></Routes></MemoryRouter>);
    await screen.findByLabelText('Bedtime');
    fireEvent.click(screen.getByRole('button', { name: 'Save Sleep' }));
    await screen.findByRole('heading', { name: 'Done' });
    expect(bodies[0]).toMatchObject({ bedtime: '23:30', wakeTime: '07:00', durationMinutes: 450, qualityScore: null });
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
