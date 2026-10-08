export type TargetPriceStatus = "TARGET_REACHED" | "MONITORING";

export interface TargetPriceEvaluation {
  status: TargetPriceStatus;
  currentPrice: number;
  targetPrice: number;
  amountUntilTarget: number;
  amountBelowTarget: number;
  differencePercentage: number;
}

export type SmartAlertType =
  | "PRICE_DROP"
  | "TARGET_REACHED"
  | "ALL_TIME_LOW"
  | "PERCENTAGE_DROP"
  | "BACK_IN_STOCK"
  | "PRICE_INCREASE";

export interface SmartAlertRule {
  id: string;
  type: SmartAlertType;
  targetPrice?: number | null;
  percentageDrop?: number | null;
  isActive: boolean;
}

export interface AlertPricePoint {
  price: number;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  checkedAt: string;
}

export interface SmartAlertContext {
  current: AlertPricePoint;
  previous: AlertPricePoint | null;
  priorHistory: AlertPricePoint[];
}

export interface AlertTrigger {
  ruleId: string;
  type: SmartAlertType;
  reason: string;
}
