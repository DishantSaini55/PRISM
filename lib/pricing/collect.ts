import { scrapeProduct } from "@/lib/scrapers";

import type {
  PriceAvailability,
  PriceObservation,
  ProductSourceToCollect
} from "./types";

function normalizeAvailability(value: string | null): PriceAvailability {
  const normalized = value?.toLowerCase() ?? "";

  if (/out of stock|sold out|unavailable|not available/.test(normalized)) {
    return "OUT_OF_STOCK";
  }

  if (/in stock|available|ready to ship/.test(normalized)) {
    return "IN_STOCK";
  }

  return "UNKNOWN";
}

export async function collectPrice(
  source: ProductSourceToCollect
): Promise<PriceObservation> {
  const product = await scrapeProduct(source.url);

  if (product.currentPrice === null) {
    throw new Error("The source did not provide a current price.");
  }

  if (!product.currency) {
    throw new Error("The source did not provide a currency code.");
  }

  return {
    productSourceId: source.id,
    sourceUrl: source.url,
    price: product.currentPrice,
    currency: product.currency,
    availability: normalizeAvailability(product.availability),
    checkedAt: new Date().toISOString(),
    product
  };
}
