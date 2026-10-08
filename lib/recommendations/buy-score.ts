import type { BuyScoreComponent, BuyScoreInput, BuyScoreResult } from "./types";

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateBuyScore(input: BuyScoreInput): BuyScoreResult | null {
  const currentPrice = input.analytics.currentPrice;

  if (currentPrice === null) {
    return null;
  }

  const components: BuyScoreComponent[] = [];
  const { lowestPrice, highestPrice } = input.analytics;

  if (lowestPrice !== null && highestPrice !== null) {
    const range = highestPrice - lowestPrice;
    const score = range === 0 ? 50 : ((highestPrice - currentPrice) / range) * 100;

    components.push({
      name: "Historical price position",
      configuredWeight: 25,
      score: round(clamp(score)),
      reason: "Compares the current price with the observed historical range."
    });
  }

  if (input.discountPercentage !== null && Number.isFinite(input.discountPercentage)) {
    components.push({
      name: "Discount",
      configuredWeight: 20,
      score: round(clamp((input.discountPercentage / 30) * 100)),
      reason: "A 30% or larger verified discount receives the maximum component score."
    });
  }

  if (input.analytics.priceChangePercentage !== null) {
    components.push({
      name: "Recent trend",
      configuredWeight: 20,
      score: round(clamp(50 - input.analytics.priceChangePercentage * 5)),
      reason: "Recent price decreases increase this component; increases reduce it."
    });
  }

  if (input.forecast && currentPrice > 0) {
    const forecastChange =
      ((input.forecast.predictedPrice - currentPrice) / currentPrice) * 100;

    components.push({
      name: "7-day forecast",
      configuredWeight: 20,
      score: round(clamp(50 + forecastChange * 5)),
      reason: "A forecast above the current price favors buying sooner."
    });
  }

  if (input.analytics.volatilityPercentage !== null) {
    components.push({
      name: "Volatility",
      configuredWeight: 10,
      score: round(clamp(100 - input.analytics.volatilityPercentage * 5)),
      reason: "Lower historical volatility produces a higher score."
    });
  }

  const availabilityScore =
    input.availability === "IN_STOCK"
      ? 100
      : input.availability === "UNKNOWN"
        ? 50
        : 0;
  components.push({
    name: "Availability",
    configuredWeight: 5,
    score: availabilityScore,
    reason: "In-stock listings score higher than unknown or unavailable listings."
  });

  const totalWeight = components.reduce(
    (total, component) => total + component.configuredWeight,
    0
  );
  const weightedScore = components.reduce(
    (total, component) =>
      total + component.score * component.configuredWeight,
    0
  );

  return {
    score: round(weightedScore / totalWeight),
    components,
    reasoning: components.map(
      (component) => `${component.name}: ${component.score}/100. ${component.reason}`
    )
  };
}
