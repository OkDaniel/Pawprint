import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { MoodTrendPoint } from '@capstone/shared';
import { buildMoodLineSegments, formatMood, type IndexedMoodPoint } from './moodTrendChartModel';
import styles from './InsightsPage.module.css';

interface ChartDimensions {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const DESKTOP_DIMENSIONS: ChartDimensions = { width: 720, height: 300, left: 45, right: 18, top: 18, bottom: 52 };
const COMPACT_DIMENSIONS: ChartDimensions = { width: 420, height: 300, left: 38, right: 12, top: 18, bottom: 52 };
const X_LABEL_INDICES = [0, 7, 14, 21, 29];

interface MoodTrendChartProps {
  points: MoodTrendPoint[];
  trackedDays: number;
  averageMood: number | null;
}

export function MoodTrendChart({ points, trackedDays, averageMood }: MoodTrendChartProps) {
  const compact = useCompactChart();
  const dimensions = compact ? COMPACT_DIMENSIONS : DESKTOP_DIMENSIONS;
  const tracked = useMemo(
    () => points.map((point, index) => ({ point, index })).filter(({ point }) => point.moodMean != null),
    [points],
  );
  const [selectedDate, setSelectedDate] = useState(() => tracked.at(-1)?.point.logicalDate ?? null);
  const selected = tracked.find(({ point }) => point.logicalDate === selectedDate) ?? tracked.at(-1) ?? null;
  const segments = useMemo(() => buildMoodLineSegments(points), [points]);

  function selectPoint(item: IndexedMoodPoint): void {
    setSelectedDate(item.point.logicalDate);
  }

  function handlePointKeyDown(event: KeyboardEvent<SVGGElement>, item: IndexedMoodPoint): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPoint(item);
    }
  }

  function handleChartPointer(event: PointerEvent<SVGSVGElement>): void {
    if (tracked.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewBoxX = (event.clientX - bounds.left) / bounds.width * dimensions.width;
    const nearest = tracked.reduce((best, item) => (
      Math.abs(xFor(item.index, dimensions) - viewBoxX) < Math.abs(xFor(best.index, dimensions) - viewBoxX) ? item : best
    ));
    selectPoint(nearest);
  }

  return (
    <div className={styles.chartRegion!} role="region" aria-label="30-day Mood chart">
      <p className={styles.visuallyHidden!}>
        Mood data for {trackedDays} of the last 30 days.
        {' '}Average Mood {averageMood == null ? 'is unavailable' : `is ${formatMood(averageMood)} out of 5`}.
      </p>
      <p className={styles.interactionHint!}>Select a point to view that day.</p>
      <svg
        className={styles.chart!}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        role="group"
        aria-label="Daily average Mood values. Use Tab to inspect tracked days, or tap the chart."
        onPointerDown={handleChartPointer}
      >
        {[5, 4, 3, 2, 1].map((value) => {
          const y = yFor(value, dimensions);
          return <g key={value}>
            <line className={styles.gridLine!} x1={dimensions.left} x2={dimensions.width - dimensions.right} y1={y} y2={y} />
            <text className={styles.axisLabel!} x={dimensions.left - 15} y={y + 5} textAnchor="middle">{value}</text>
          </g>;
        })}
        {X_LABEL_INDICES.map((index) => {
          const point = points[index];
          if (!point) return null;
          return <text
            className={styles.axisLabel!}
            key={point.logicalDate}
            x={xFor(index, dimensions)}
            y={dimensions.height - 18}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          >{formatShortDate(point.logicalDate)}</text>;
        })}
        {segments.map((segment) => <g data-testid="mood-line-segment" key={segment[0]?.point.logicalDate}>
          {segment.length > 1 && <polyline
            className={styles.trendLine!}
            points={segment.map(({ point, index }) => `${xFor(index, dimensions)},${yFor(point.moodMean!, dimensions)}`).join(' ')}
          />}
        </g>)}
        {tracked.map((item) => {
          const label = pointAccessibleLabel(item.point);
          const selectedPoint = selected?.point.logicalDate === item.point.logicalDate;
          return <g
            className={styles.pointTarget!}
            data-selected={selectedPoint || undefined}
            key={item.point.logicalDate}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selectedPoint}
            onFocus={() => selectPoint(item)}
            onKeyDown={(event) => handlePointKeyDown(event, item)}
          >
            <circle className={styles.pointHitArea!} cx={xFor(item.index, dimensions)} cy={yFor(item.point.moodMean!, dimensions)} r="15" />
            <circle className={styles.selectionRing!} cx={xFor(item.index, dimensions)} cy={yFor(item.point.moodMean!, dimensions)} r="10" />
            <circle className={styles.dataPoint!} cx={xFor(item.index, dimensions)} cy={yFor(item.point.moodMean!, dimensions)} r="5" />
          </g>;
        })}
      </svg>
      {selected && <div className={styles.pointDetails!} aria-live="polite">
        <span className={styles.pointDetailsLabel!}>Selected day</span>
        <div className={styles.pointDetailsContent!}>
          <strong>{formatLongDate(selected.point.logicalDate)}</strong>
          <span className={styles.pointDetailsSummary!}>
            <span>Mood {formatMood(selected.point.moodMean!)} / 5</span>
            <span aria-hidden="true">·</span>
            <span>{selected.point.checkInCount} {selected.point.checkInCount === 1 ? 'Check-In' : 'Check-Ins'}</span>
          </span>
        </div>
      </div>}
    </div>
  );
}

function xFor(index: number, dimensions: ChartDimensions): number {
  return dimensions.left + index / 29 * (dimensions.width - dimensions.left - dimensions.right);
}

function yFor(mood: number, dimensions: ChartDimensions): number {
  return dimensions.top + (5 - mood) / 4 * (dimensions.height - dimensions.top - dimensions.bottom);
}

function useCompactChart(): boolean {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 620px)').matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 620px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}

function parseLogicalDate(logicalDate: string): Date {
  return new Date(`${logicalDate}T00:00:00.000Z`);
}

function formatShortDate(logicalDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parseLogicalDate(logicalDate));
}

function formatLongDate(logicalDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parseLogicalDate(logicalDate));
}

function pointAccessibleLabel(point: MoodTrendPoint): string {
  return `${formatLongDate(point.logicalDate)}: Mood ${formatMood(point.moodMean!)} out of 5 from ${point.checkInCount} ${point.checkInCount === 1 ? 'Check-In' : 'Check-Ins'}`;
}
