import type { PriceAnalytics, PriceHistoryPoint } from "./types";

interface DatedPricePoint extends PriceHistoryPoint {
  timestamp: number;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentage(value: number, base: number) {
  return base === 0 ? null : (value / base) * 100;
}

function getWindowAverage(
  observations: DatedPricePoint[],
  now: number,
  days: number
) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const prices = observations
    .filter((observation) => observation.timestamp >= cutoff)
    .map((observation) => observation.price);
  const result = average(prices);

  return result === null ? null : round(result);
}

export function calculatePriceAnalytics(
  points: PriceHistoryPoint[],
  referenceDate = new Date()
): PriceAnalytics {
  const observations = points
    .map((point) => ({ ...point, timestamp: new Date(point.checkedAt).getTime() }))
    .filter(
      (point) =>
        Number.isFinite(point.price) &&
        point.price >= 0 &&
        Number.isFinite(point.timestamp)
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  if (observations.length === 0) {
    return {
      observationCount: 0,
      currentPrice: null,
      lowestPrice: null,
      highestPrice: null,
      averagePrice: null,
      medianPrice: null,
      sevenDayAverage: null,
      thirtyDayAverage: null,
      priceChange: null,
      priceChangePercentage: null,
      volatilityPercentage: null,
      distanceFromLow: null,
      distanceFromLowPercentage: null,
      distanceFromAverage: null,
      distanceFromAveragePercentage: null
    };
  }

  const prices = observations.map((observation) => observation.price);
  const currentPrice = prices.at(-1) ?? null;
  const previousPrice = prices.length > 1 ? prices.at(-2) ?? null : null;
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const rawAverage = average(prices);
  const sortedPrices = [...prices].sort((left, right) => left - right);
  const middle = Math.floor(sortedPrices.length / 2);
  const medianPrice =
    sortedPrices.length % 2 === 0
      ? (sortedPrices[middle - 1] + sortedPrices[middle]) / 2
      : sortedPrices[middle];
  const variance =
    rawAverage === null
      ? null
      : average(prices.map((price) => (price - rawAverage) ** 2));
  const volatilityPercentage =
    variance === null || rawAverage === null || rawAverage === 0
      ? null
      : (Math.sqrt(variance) / rawAverage) * 100;
  const priceChange =
    currentPrice === null || previousPrice === null
      ? null
      : currentPrice - previousPrice;
  const distanceFromLow =
    currentPrice === null ? null : currentPrice - lowestPrice;
  const distanceFromAverage =
    currentPrice === null || rawAverage === null ? null : currentPrice - rawAverage;
  const priceChangePercentage =
    priceChange === null || previousPrice === null
      ? null
      : percentage(priceChange, previousPrice);
  const distanceFromLowPercentage =
    distanceFromLow === null ? null : percentage(distanceFromLow, lowestPrice);
  const distanceFromAveragePercentage =
    distanceFromAverage === null || rawAverage === null
      ? null
      : percentage(distanceFromAverage, rawAverage);

  return {
    observationCount: observations.length,
    currentPrice: currentPrice === null ? null : round(currentPrice),
    lowestPrice: round(lowestPrice),
    highestPrice: round(highestPrice),
    averagePrice: rawAverage === null ? null : round(rawAverage),
    medianPrice: round(medianPrice),
    sevenDayAverage: getWindowAverage(observations, referenceDate.getTime(), 7),
    thirtyDayAverage: getWindowAverage(observations, referenceDate.getTime(), 30),
    priceChange: priceChange === null ? null : round(priceChange),
    priceChangePercentage:
      priceChangePercentage === null ? null : round(priceChangePercentage),
    volatilityPercentage:
      volatilityPercentage === null ? null : round(volatilityPercentage),
    distanceFromLow: distanceFromLow === null ? null : round(distanceFromLow),
    distanceFromLowPercentage:
      distanceFromLowPercentage === null ? null : round(distanceFromLowPercentage),
    distanceFromAverage:
      distanceFromAverage === null ? null : round(distanceFromAverage),
    distanceFromAveragePercentage:
      distanceFromAveragePercentage === null
        ? null
        : round(distanceFromAveragePercentage)
  };
}
