import type { PriceHistoryPoint, PriceForecast } from "./types";

interface DatedPricePoint extends PriceHistoryPoint {
  timestamp: number;
}

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const minimumObservations = 7;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function forecastPrice(
  points: PriceHistoryPoint[],
  horizonDays: number
): PriceForecast | null {
  if (!Number.isInteger(horizonDays) || horizonDays < 1) {
    throw new Error("Forecast horizon must be a positive whole number of days.");
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

  if (observations.length < minimumObservations) {
    return null;
  }

  const firstTimestamp = observations[0].timestamp;
  const xs = observations.map(
    (observation) => (observation.timestamp - firstTimestamp) / dayInMilliseconds
  );
  const ys = observations.map((observation) => observation.price);
  const meanX = xs.reduce((total, value) => total + value, 0) / xs.length;
  const meanY = ys.reduce((total, value) => total + value, 0) / ys.length;
  const denominator = xs.reduce(
    (total, value) => total + (value - meanX) ** 2,
    0
  );

  if (denominator === 0) {
    return null;
  }

  const slope = xs.reduce(
    (total, value, index) => total + (value - meanX) * (ys[index] - meanY),
    0
  ) / denominator;
  const intercept = meanY - slope * meanX;
  const finalX = xs.at(-1) ?? 0;
  const prediction = Math.max(0, intercept + slope * (finalX + horizonDays));
  const residualSum = ys.reduce(
    (total, value, index) => total + (value - (intercept + slope * xs[index])) ** 2,
    0
  );
  const totalSum = ys.reduce((total, value) => total + (value - meanY) ** 2, 0);
  const rSquared = totalSum === 0 ? 1 : 1 - residualSum / totalSum;

  return {
    horizonDays,
    predictedPrice: round(prediction),
    confidence: round(clamp(rSquared, 0, 1) * 100),
    trainingObservationCount: observations.length,
    trainedThrough: observations.at(-1)?.checkedAt ?? "",
    modelVersion: "linear-regression-v1"
  };
}

export function forecastStandardHorizons(points: PriceHistoryPoint[]) {
  return [7, 30]
    .map((horizonDays) => forecastPrice(points, horizonDays))
    .filter((forecast): forecast is PriceForecast => forecast !== null);
}
