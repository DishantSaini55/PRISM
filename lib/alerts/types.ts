export type TargetPriceStatus = "TARGET_REACHED" | "MONITORING";

export interface TargetPriceEvaluation {
  status: TargetPriceStatus;
  currentPrice: number;
  targetPrice: number;
  amountUntilTarget: number;
  amountBelowTarget: number;
  differencePercentage: number;
}
