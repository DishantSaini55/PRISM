import type { PriceAnalytics } from "@/lib/analytics";
import type { PriceForecast } from "@/lib/forecasting";
import type { PriceAvailability } from "@/lib/pricing";

export interface BuyScoreInput {
  analytics: PriceAnalytics;
  discountPercentage: number | null;
  forecast: PriceForecast | null;
  availability: PriceAvailability;
}

export interface BuyScoreComponent {
  name: string;
  configuredWeight: number;
  score: number;
  reason: string;
}

export interface BuyScoreResult {
  score: number;
  components: BuyScoreComponent[];
  reasoning: string[];
}

export type RecommendationAction = "BUY_NOW" | "MONITOR" | "WAIT";

export interface RecommendationResult {
  action: RecommendationAction;
  buyScore: number;
  title: string;
  reasoning: string[];
  /**
   * These rules are transparent defaults. They need calibration with historical
   * outcomes before being treated as validated purchase advice.
   */
  thresholdNote: string;
}
