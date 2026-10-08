import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePriceAnalytics } from "@/lib/analytics";
import { calculateBuyScore } from "./buy-score";
import { determineRecommendation } from "./decision";

function toPriceAvailability(value: string) {
  if (value === "IN_STOCK") return "IN_STOCK" as const;
  if (value === "OUT_OF_STOCK" || value === "DISCONTINUED") {
    return "OUT_OF_STOCK" as const;
  }

  return "UNKNOWN" as const;
}

function evidenceConfidence(observationCount: number) {
  // Seven observations is the minimum for the baseline forecasting model.
  return Math.round(Math.min(100, (observationCount / 7) * 100) * 100) / 100;
}

export async function persistRecommendationForSource(
  client: SupabaseClient,
  productSourceId: string
) {
  const { data: source, error: sourceError } = await client
    .from("product_sources")
    .select("id, product_id, discount_percentage, availability")
    .eq("id", productSourceId)
    .single();

  if (sourceError || !source?.product_id) {
    throw new Error(sourceError?.message || "Product source was not found.");
  }

  const { data: history, error: historyError } = await client
    .from("price_history")
    .select("price, checked_at")
    .eq("product_source_id", productSourceId)
    .order("checked_at", { ascending: true });

  if (historyError) {
    throw new Error(`Unable to read price history: ${historyError.message}`);
  }

  const analytics = calculatePriceAnalytics(
    (history || []).map((point) => ({
      price: Number(point.price),
      checkedAt: point.checked_at
    }))
  );
  const buyScore = calculateBuyScore({
    analytics,
    discountPercentage:
      source.discount_percentage === null
        ? null
        : Number(source.discount_percentage),
    forecast: null,
    availability: toPriceAvailability(source.availability)
  });
  const recommendation = determineRecommendation(buyScore);

  if (!buyScore || !recommendation) {
    return null;
  }

  const { error: insertError } = await client.from("recommendations").insert({
    product_id: source.product_id,
    buy_score: buyScore.score,
    recommendation: recommendation.action,
    confidence: evidenceConfidence(analytics.observationCount),
    reasoning: {
      title: recommendation.title,
      reasoning: recommendation.reasoning,
      components: buyScore.components,
      thresholdNote: recommendation.thresholdNote,
      observationCount: analytics.observationCount,
      forecastIncluded: false
    }
  });

  if (insertError) {
    throw new Error(`Unable to save recommendation: ${insertError.message}`);
  }

  return recommendation;
}
