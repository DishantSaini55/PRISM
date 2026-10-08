import type { PriceHistoryPoint } from "@/lib/analytics";

export interface ForecastFeatureRow {
  observedAt: string;
  targetObservedAt: string;
  targetHorizonDays: number;
  currentPrice: number;
  movingAverage7Days: number;
  movingAverage30Days: number;
  recentChangePercentage: number;
  volatility7Days: number;
  dayOfWeek: number;
  daysSinceFirstObservation: number;
  targetPrice: number;
}

export interface PriceForecast {
  horizonDays: number;
  predictedPrice: number;
  confidence: number;
  trainingObservationCount: number;
  trainedThrough: string;
  modelVersion: "linear-regression-v1";
}

export type { PriceHistoryPoint };
