import type { MoodTrendPoint } from '@capstone/shared';

export interface IndexedMoodPoint {
  point: MoodTrendPoint;
  index: number;
}

export function buildMoodLineSegments(points: MoodTrendPoint[]): IndexedMoodPoint[][] {
  const segments: IndexedMoodPoint[][] = [];
  let current: IndexedMoodPoint[] = [];
  points.forEach((point, index) => {
    if (point.moodMean == null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ point, index });
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

export function formatMood(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
