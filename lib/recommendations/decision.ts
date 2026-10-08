import type { BuyScoreResult, RecommendationResult } from "./types";

/**
 * Provisional, human-readable recommendation thresholds. Keep them centralized
 * so they can later be calibrated by backtesting against actual price outcomes.
 */
export const RECOMMENDATION_THRESHOLDS = {
  BUY_NOW: 80,
  MONITOR: 50
} as const;

const THRESHOLD_NOTE =
  "This is a transparent rule-based recommendation, not a guaranteed prediction. Thresholds must be calibrated through backtesting.";

export function determineRecommendation(
  buyScore: BuyScoreResult | null
): RecommendationResult | null {
  if (!buyScore) {
    return null;
  }

  if (buyScore.score >= RECOMMENDATION_THRESHOLDS.BUY_NOW) {
    return {
      action: "BUY_NOW",
      buyScore: buyScore.score,
      title: "Buy now",
      reasoning: [
        "The current evidence produces a high Buy Score.",
        ...buyScore.reasoning
      ],
      thresholdNote: THRESHOLD_NOTE
    };
  }

  if (buyScore.score >= RECOMMENDATION_THRESHOLDS.MONITOR) {
    return {
      action: "MONITOR",
      buyScore: buyScore.score,
      title: "Monitor the price",
      reasoning: [
        "The evidence is mixed, so tracking future price changes is safer than acting immediately.",
        ...buyScore.reasoning
      ],
      thresholdNote: THRESHOLD_NOTE
    };
  }

  return {
    action: "WAIT",
    buyScore: buyScore.score,
    title: "Wait for a better price",
    reasoning: [
      "The current evidence does not support buying at this price yet.",
      ...buyScore.reasoning
    ],
    thresholdNote: THRESHOLD_NOTE
  };
}
