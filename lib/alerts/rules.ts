import { evaluateTargetPrice } from "./target-price";
import type {
  AlertTrigger,
  SmartAlertContext,
  SmartAlertRule
} from "./types";

function isAllTimeLow(context: SmartAlertContext) {
  const priorPrices = context.priorHistory.map((point) => point.price);

  return priorPrices.length > 0 && context.current.price < Math.min(...priorPrices);
}

export function evaluateSmartAlerts(
  rules: SmartAlertRule[],
  context: SmartAlertContext
): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];
  const previous = context.previous;

  for (const rule of rules.filter((candidate) => candidate.isActive)) {
    if (rule.type === "TARGET_REACHED" && rule.targetPrice !== null && rule.targetPrice !== undefined) {
      const evaluation = evaluateTargetPrice(context.current.price, rule.targetPrice);

      if (evaluation.status === "TARGET_REACHED") {
        triggers.push({
          ruleId: rule.id,
          type: rule.type,
          reason: `Current price reached the target of ${evaluation.targetPrice}.`
        });
      }
    }

    if (rule.type === "ALL_TIME_LOW" && isAllTimeLow(context)) {
      triggers.push({
        ruleId: rule.id,
        type: rule.type,
        reason: "Current price is lower than every prior observation."
      });
    }

    if (!previous) {
      continue;
    }

    if (rule.type === "PRICE_DROP" && context.current.price < previous.price) {
      triggers.push({
        ruleId: rule.id,
        type: rule.type,
        reason: "Current price is lower than the previous observation."
      });
    }

    if (rule.type === "PRICE_INCREASE" && context.current.price > previous.price) {
      triggers.push({
        ruleId: rule.id,
        type: rule.type,
        reason: "Current price is higher than the previous observation."
      });
    }

    if (
      rule.type === "PERCENTAGE_DROP" &&
      rule.percentageDrop !== null &&
      rule.percentageDrop !== undefined &&
      previous.price > 0
    ) {
      const percentageDrop = ((previous.price - context.current.price) / previous.price) * 100;

      if (percentageDrop >= rule.percentageDrop) {
        triggers.push({
          ruleId: rule.id,
          type: rule.type,
          reason: `Price dropped by ${percentageDrop.toFixed(2)}%, meeting the configured threshold.`
        });
      }
    }

    if (
      rule.type === "BACK_IN_STOCK" &&
      previous.availability !== "IN_STOCK" &&
      context.current.availability === "IN_STOCK"
    ) {
      triggers.push({
        ruleId: rule.id,
        type: rule.type,
        reason: "Product changed from unavailable to in stock."
      });
    }
  }

  return triggers;
}
