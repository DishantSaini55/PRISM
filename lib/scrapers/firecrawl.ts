import { z } from "zod";

import { createFirecrawlClient } from "@/lib/firecrawl-client";
import type { ProductData, ProductScraper } from "./types";

type ExtractedProduct = Record<string, unknown>;

const optionalString = z.string().nullable().optional();
const optionalNumber = z.number().nullable().optional();

const productSchema = z.object({
  productName: optionalString,
  brand: optionalString,
  model: optionalString,
  category: optionalString,
  currentPrice: optionalNumber,
  mrp: optionalNumber,
  currencyCode: optionalString,
  productImageUrl: optionalString,
  rating: optionalNumber,
  reviewCount: optionalNumber,
  availability: optionalString,
  seller: optionalString,
  shipping: optionalString,
  color: optionalString,
  storage: optionalString,
  variant: optionalString
});

function asRecord(value: unknown): ExtractedProduct {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ExtractedProduct)
    : {};
}

function asNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function asCurrency(value: unknown) {
  const currency = asNullableString(value)?.toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export const firecrawlProductScraper: ProductScraper = {
  name: "firecrawl",

  canHandle(url) {
    try {
      const parsedUrl = new URL(url);
      return ["http:", "https:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  },

  async scrape(url) {
    const firecrawl = createFirecrawlClient();
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["extract"],
      extract: {
        prompt:
          "Extract the product information. Return only facts visible on the page. Use null when a field is unavailable. Prices must be numeric values without symbols. Currency must be a three-letter ISO code.",
        schema: productSchema
      }
    });

    const extracted = asRecord(
      (result as { extract?: unknown }).extract
    );

    return {
      sourceUrl: url,
      provider: "firecrawl",
      name: asNullableString(extracted.productName),
      brand: asNullableString(extracted.brand),
      model: asNullableString(extracted.model),
      category: asNullableString(extracted.category),
      currentPrice: asNullableNumber(extracted.currentPrice),
      mrp: asNullableNumber(extracted.mrp),
      currency: asCurrency(extracted.currencyCode),
      imageUrl: asNullableString(extracted.productImageUrl),
      rating: asNullableNumber(extracted.rating),
      reviewCount: asNullableNumber(extracted.reviewCount),
      availability: asNullableString(extracted.availability),
      seller: asNullableString(extracted.seller),
      shipping: asNullableString(extracted.shipping),
      color: asNullableString(extracted.color),
      storage: asNullableString(extracted.storage),
      variant: asNullableString(extracted.variant),
      extractedAt: new Date().toISOString()
    };
  }
};
