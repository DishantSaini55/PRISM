import type { PriceHistoryPoint } from "@/lib/analytics";

import type { ForecastFeatureRow } from "./types";

interface DatedPricePoint extends PriceHistoryPoint {
  timestamp: number;
}

const dayInMilliseconds = 24 * 60 * 60 * 1000;

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function trailingPrices(
  points: DatedPricePoint[],
  currentTimestamp: number,
  days: number
) {
  const cutoff = currentTimestamp - days * dayInMilliseconds;
  return points
    .filter((point) => point.timestamp >= cutoff)
    .map((point) => point.price);
}

function volatilityPercentage(values: number[]) {
  const mean = average(values);

  if (mean === 0) {
    return 0;
  }

  const variance = average(values.map((value) => (value - mean) ** 2));
  return (Math.sqrt(variance) / mean) * 100;
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function createForecastFeatureRows(
  points: PriceHistoryPoint[],
  targetHorizonDays = 7
): ForecastFeatureRow[] {
  if (!Number.isInteger(targetHorizonDays) || targetHorizonDays < 1) {
    throw new Error("Target horizon must be a positive whole number of days.");
  }

  const observations = points
    .map((point) => ({ ...point, timestamp: new Date(point.checkedAt).getTime() }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.price) &&
        point.price >= 0
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  return observations.flatMap((current, index) => {
    if (index === 0) {
      return [];
    }

    const targetTimestamp = current.timestamp + targetHorizonDays * dayInMilliseconds;
    const target = observations.slice(index + 1).find((point) => point.timestamp >= targetTimestamp);

    if (!target) {
      return [];
    }

    const historyToDate = observations.slice(0, index + 1);
    const sevenDayPrices = trailingPrices(historyToDate, current.timestamp, 7);
    const thirtyDayPrices = trailingPrices(historyToDate, current.timestamp, 30);
    const previous = observations[index - 1];
    const recentChangePercentage =
      previous.price === 0
        ? 0
        : ((current.price - previous.price) / previous.price) * 100;

    return [
      {
        observedAt: current.checkedAt,
        targetObservedAt: target.checkedAt,
        targetHorizonDays,
        currentPrice: round(current.price),
        movingAverage7Days: round(average(sevenDayPrices)),
        movingAverage30Days: round(average(thirtyDayPrices)),
        recentChangePercentage: round(recentChangePercentage),
        volatility7Days: round(volatilityPercentage(sevenDayPrices)),
        dayOfWeek: new Date(current.timestamp).getUTCDay(),
        daysSinceFirstObservation: round(
          (current.timestamp - observations[0].timestamp) / dayInMilliseconds
        ),
        targetPrice: round(target.price)
      }
    ];
  });
}
