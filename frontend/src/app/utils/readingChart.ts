import { differenceInCalendarDays } from "date-fns";
import type { ReadingResponse } from "../types/api";
import { parseBackendTimestamp } from "./datetime";
import { dateParam } from "./readingFilters";

const MAX_CHART_POINTS = 450;
const MS_IN_MINUTE = 60 * 1000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
export const MS_IN_DAY = 24 * MS_IN_HOUR;
const BUCKET_OPTIONS_MS = [
  30 * MS_IN_MINUTE,
  1 * MS_IN_HOUR,
  2 * MS_IN_HOUR,
  3 * MS_IN_HOUR,
  6 * MS_IN_HOUR,
  12 * MS_IN_HOUR,
  1 * MS_IN_DAY,
  2 * MS_IN_DAY,
  7 * MS_IN_DAY,
];

const metricKeys = ["soilHumidity", "waterFlow", "soilTemp", "airTemp", "relativeHumidity", "eto"] as const;
type MetricKey = typeof metricKeys[number];
type HistoricalChartPoint = { timestampMs: number } & Record<MetricKey, number | null>;

type ChartAggregationResult = {
  bucketMs: number;
  points: HistoricalChartPoint[];
};

function getBaseBucketMs(daySpan: number): number {
  if (daySpan <= 7) return 30 * MS_IN_MINUTE;
  if (daySpan <= 30) return 2 * MS_IN_HOUR;
  if (daySpan <= 90) return 6 * MS_IN_HOUR;
  if (daySpan <= 365) return 1 * MS_IN_DAY;
  return 2 * MS_IN_DAY;
}

function chooseBucketMs(daySpan: number, rangeMs: number): number {
  const baseBucketMs = getBaseBucketMs(daySpan);
  const requiredBucketMs = Math.max(1, Math.ceil(rangeMs / MAX_CHART_POINTS));
  const desiredBucketMs = Math.max(baseBucketMs, requiredBucketMs);

  for (const option of BUCKET_OPTIONS_MS) {
    if (option >= desiredBucketMs) {
      return option;
    }
  }

  return desiredBucketMs;
}

export function aggregateReadingsForChart(
  readings: ReadingResponse[],
  rangeStart: Date,
  rangeEnd: Date,
): ChartAggregationResult {
  const startMs = Date.parse(`${dateParam(rangeStart)}T00:00:00Z`);
  const endMs = Date.parse(`${dateParam(rangeEnd)}T23:59:59.999Z`);
  const daySpan = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const rangeMs = Math.max(1, endMs - startMs + 1);
  const bucketMs = chooseBucketMs(daySpan, rangeMs);

  const buckets = new Map<number, Record<MetricKey, { sum: number; count: number }>>();
  for (const reading of readings) {
    const readingMs = parseBackendTimestamp(reading.timestamp)?.getTime();
    if (readingMs == null || !Number.isFinite(readingMs) || readingMs < startMs || readingMs > endMs) continue;
    const timestampMs = startMs + Math.floor((readingMs - startMs) / bucketMs) * bucketMs;
    const values = {
      soilHumidity: reading.soil?.humidity, waterFlow: reading.irrigation?.flow_per_minute,
      soilTemp: reading.soil?.temperature, airTemp: reading.environmental?.temperature,
      relativeHumidity: reading.environmental?.relative_humidity, eto: reading.environmental?.eto,
    };
    let bucket = buckets.get(timestampMs);
    if (!bucket) {
      bucket = Object.fromEntries(metricKeys.map((key) => [key, { sum: 0, count: 0 }])) as Record<MetricKey, { sum: number; count: number }>;
      buckets.set(timestampMs, bucket);
    }
    for (const key of metricKeys) {
      const value = values[key];
      if (value != null && Number.isFinite(value)) { bucket[key].sum += value; bucket[key].count += 1; }
    }
  }
  const points = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([timestampMs, bucket]) => ({
    timestampMs,
    ...Object.fromEntries(metricKeys.map((key) => [key, bucket[key].count ? bucket[key].sum / bucket[key].count : null])),
  } as HistoricalChartPoint));

  if (points.length <= MAX_CHART_POINTS) {
    return { bucketMs, points };
  }

  const step = Math.ceil(points.length / MAX_CHART_POINTS);
  return {
    bucketMs,
    points: points.filter((_, index) => index % step === 0 || index === points.length - 1),
  };
}

