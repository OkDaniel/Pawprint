// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MoodTrendPoint, MoodTrendResponse } from '@capstone/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InsightsPage } from './InsightsPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function pointsWith(values: Record<number, { moodMean: number; checkInCount: number }> = {}): MoodTrendPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10);
    const value = values[index];
    return { logicalDate: date, moodMean: value?.moodMean ?? null, checkInCount: value?.checkInCount ?? 0 };
  });
}

function trend(overrides: Partial<MoodTrendResponse> = {}): MoodTrendResponse {
  return {
    range: { startLogicalDate: '2026-09-01', endLogicalDate: '2026-09-30', days: 30 },
    summary: { trackedDays: 3, totalCheckIns: 4, averageMood: 3.125 },
    points: pointsWith({
      0: { moodMean: 3, checkInCount: 1 },
      1: { moodMean: 3.5, checkInCount: 2 },
      3: { moodMean: 2, checkInCount: 1 },
    }),
    ...overrides,
  };
}

describe('InsightsPage', () => {
  it('shows an intentional loading state without flashing empty metrics', async () => {
    let resolveRequest!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    render(<InsightsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your Mood trend');
    expect(screen.queryByText('No Mood data yet')).not.toBeInTheDocument();
    resolveRequest(json(trend()));
    expect(await screen.findByRole('heading', { name: 'Mood over the last 30 days' })).toBeInTheDocument();
  });

  it('renders summaries, fractional daily values, accessible points, and visual gaps', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(trend()));
    render(<InsightsPage />);

    expect(await screen.findByText('3.1 / 5')).toBeInTheDocument();
    expect(screen.getByText('3 / 30')).toBeInTheDocument();
    expect(screen.getByText('4', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mood-line-segment')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Mood .* out of 5 from .* Check-In/ })).toHaveLength(3);
    expect(screen.getByText('Daily average from your Check-Ins')).toBeInTheDocument();
    expect(screen.queryByText('Select a point to view that day.')).not.toBeInTheDocument();
    expect(screen.queryByText('This view summarizes what you recorded; it does not identify causes.')).not.toBeInTheDocument();

    const chart = screen.getByRole('group', { name: /Daily average Mood values/ });
    expect(chart.querySelector('title')).toBeNull();
    expect(chart.querySelector('[title]')).toBeNull();

    const initiallySelectedPoint = screen.getByRole('button', { name: 'Sep 4, 2026: Mood 2 out of 5 from 1 Check-In' });
    expect(initiallySelectedPoint).toHaveAttribute('aria-pressed', 'true');
    expect(initiallySelectedPoint.querySelector('[class*="selectionRing"]')).not.toBeNull();
    expect(screen.getByText('Selected day')).toBeInTheDocument();

    const fractionalPoint = screen.getByRole('button', { name: 'Sep 2, 2026: Mood 3.5 out of 5 from 2 Check-Ins' });
    fireEvent.focus(fractionalPoint);
    expect(fractionalPoint).toHaveAttribute('aria-pressed', 'true');
    expect(initiallySelectedPoint).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Mood 3.5 / 5 (~Good)')).toBeInTheDocument();
    expect(screen.getByText('2 Check-Ins')).toBeInTheDocument();

    const firstPoint = screen.getByRole('button', { name: 'Sep 1, 2026: Mood 3 out of 5 from 1 Check-In' });
    fireEvent.keyDown(firstPoint, { key: 'Enter' });
    expect(firstPoint).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mood 3 / 5 (Okay)')).toBeInTheDocument();
  });

  it.each([
    [1, 'Very Low', 'mood-very-low'],
    [2, 'Low', 'mood-low'],
    [3, 'Okay', 'mood-okay'],
    [4, 'Good', 'mood-good'],
    [5, 'Great', 'mood-great'],
  ])('pairs exact Mood %s with its canonical label and decorative artwork', async (moodMean, label, asset) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(trend({ points: pointsWith({ 0: { moodMean, checkInCount: 3 } }) })));
    render(<InsightsPage />);
    const mood = await screen.findByText(`Mood ${moodMean} / 5 (${label})`);
    const image = mood.parentElement!.querySelector('img')!;
    expect(image).toHaveAttribute('src', expect.stringContaining(asset));
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('3 Check-Ins')).toBeInTheDocument();
  });

  it.each([
    [2.33, '2.3', 'Low', 'mood-low'],
    [2.49, '2.5', 'Low', 'mood-low'],
    [2.5, '2.5', 'Okay', 'mood-okay'],
    [3.3, '3.3', 'Okay', 'mood-okay'],
    [3.3158, '3.3', 'Okay', 'mood-okay'],
    [3.4999, '3.5', 'Okay', 'mood-okay'],
    [3.5, '3.5', 'Good', 'mood-good'],
    [3.5714, '3.6', 'Good', 'mood-good'],
    [3.6, '3.6', 'Good', 'mood-good'],
    [3.3333, '3.3', 'Okay', 'mood-okay'],
    [2.9999, '3.0', 'Okay', 'mood-okay'],
    [1.0001, '1.0', 'Very Low', 'mood-very-low'],
    [1.49, '1.5', 'Very Low', 'mood-very-low'],
    [1.5, '1.5', 'Low', 'mood-low'],
    [4.4999, '4.5', 'Good', 'mood-good'],
    [4.5, '4.5', 'Great', 'mood-great'],
    [4.99, '5.0', 'Great', 'mood-great'],
    [4.9999, '5.0', 'Great', 'mood-great'],
  ])('formats fractional Mood %s while classifying and plotting the original value', async (moodMean, display, label, asset) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(trend({ points: pointsWith({ 0: { moodMean, checkInCount: 3 } }) })));
    render(<InsightsPage />);
    const mood = await screen.findByText(`Mood ${display} / 5 (~${label})`);
    const image = mood.parentElement!.querySelector('img')!;
    expect(image).toHaveAttribute('src', expect.stringContaining(asset));
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    const selectedPoint = screen.getByRole('button', { name: /Sep 1, 2026: Mood/ });
    const circle = selectedPoint.querySelector('[class*="dataPoint"]')!;
    expect(Number(circle.getAttribute('cy'))).toBeCloseTo(18 + (5 - moodMean) / 4 * 230, 8);
  });

  it('shows the zero-data empty state instead of an empty chart', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(trend({
      summary: { trackedDays: 0, totalCheckIns: 0, averageMood: null },
      points: pointsWith(),
    })));
    render(<InsightsPage />);

    expect(await screen.findByRole('heading', { name: 'No Mood data yet' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Daily average Mood values/ })).not.toBeInTheDocument();
  });

  it('renders tracked points with restrained sparse-data guidance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(trend({
      summary: { trackedDays: 1, totalCheckIns: 1, averageMood: 4 },
      points: pointsWith({ 12: { moodMean: 4, checkInCount: 1 } }),
    })));
    render(<InsightsPage />);

    expect(await screen.findByText('Keep checking in to build out your 30-day view.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sep 13, 2026: Mood 4 out of 5 from 1 Check-In' })).toBeInTheDocument();
  });

  it('shows a calm error and retries the request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ error: { message: 'database details' } }, 500))
      .mockResolvedValueOnce(json(trend()));
    render(<InsightsPage />);

    expect(await screen.findByRole('heading', { name: 'We couldn’t load your Mood trend.' })).toBeInTheDocument();
    expect(screen.queryByText('database details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: 'Mood over the last 30 days' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
