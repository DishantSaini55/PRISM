import type { TargetPriceEvaluation } from "./types";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function validateTargetPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Target price must be a positive number.");
  }

  return round(value);
}

export function evaluateTargetPrice(
  currentPrice: number,
  targetPrice: number
): TargetPriceEvaluation {
  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    throw new Error("Current price must be a non-negative number.");
  }

  const validatedTargetPrice = validateTargetPrice(targetPrice);
  const reached = currentPrice <= validatedTargetPrice;
  const difference = currentPrice - validatedTargetPrice;

  return {
    status: reached ? "TARGET_REACHED" : "MONITORING",
    currentPrice: round(currentPrice),
    targetPrice: validatedTargetPrice,
    amountUntilTarget: reached ? 0 : round(difference),
    amountBelowTarget: reached ? round(Math.abs(difference)) : 0,
    differencePercentage: round((difference / validatedTargetPrice) * 100)
  };
}
