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
