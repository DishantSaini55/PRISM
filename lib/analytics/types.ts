export interface PriceHistoryPoint {
  price: number;
  checkedAt: string;
}

export interface PriceAnalytics {
  observationCount: number;
  currentPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  sevenDayAverage: number | null;
  thirtyDayAverage: number | null;
  priceChange: number | null;
  priceChangePercentage: number | null;
  volatilityPercentage: number | null;
  distanceFromLow: number | null;
  distanceFromLowPercentage: number | null;
  distanceFromAverage: number | null;
  distanceFromAveragePercentage: number | null;
}
