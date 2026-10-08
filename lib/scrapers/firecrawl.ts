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
  ram: optionalString,
  size: optionalString,
  configuration: optionalString,
  edition: optionalString,
  generation: optionalString,
  sku: optionalString,
  gtin: optionalString,
  upc: optionalString,
  ean: optionalString,
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

function fallbackFromMarkdown(markdown: unknown) {
  if (typeof markdown !== "string") {
    return { name: null, currentPrice: null, currency: null };
  }

  const name = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() || null;
  const rupeePrice = markdown.match(/₹\s*([0-9][0-9,]*(?:\.\d{1,2})?)/)?.[1];

  return {
    name,
    currentPrice: asNullableNumber(rupeePrice),
    currency: rupeePrice ? "INR" : null
  };
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
      formats: ["extract", "markdown"],
      extract: {
        prompt:
          "Extract the product information from the primary listing, not a related product, offer card, or navigation element. Return only facts visible on the page. Use null when a field is unavailable. currentPrice is the live primary listing price. Prices must be numeric values without symbols. Currency must be a three-letter ISO code.",
        schema: productSchema
      }
    });

    const extracted = asRecord(
      (result as { extract?: unknown }).extract
    );
    const fallback = fallbackFromMarkdown(
      (result as { markdown?: unknown }).markdown
    );

    return {
      sourceUrl: url,
      provider: "firecrawl",
      name: asNullableString(extracted.productName) ?? fallback.name,
      brand: asNullableString(extracted.brand),
      model: asNullableString(extracted.model),
      category: asNullableString(extracted.category),
      currentPrice: asNullableNumber(extracted.currentPrice) ?? fallback.currentPrice,
      mrp: asNullableNumber(extracted.mrp),
      currency: asCurrency(extracted.currencyCode) ?? fallback.currency,
      imageUrl: asNullableString(extracted.productImageUrl),
      rating: asNullableNumber(extracted.rating),
      reviewCount: asNullableNumber(extracted.reviewCount),
      availability: asNullableString(extracted.availability),
      seller: asNullableString(extracted.seller),
      shipping: asNullableString(extracted.shipping),
      color: asNullableString(extracted.color),
      storage: asNullableString(extracted.storage),
      ram: asNullableString(extracted.ram),
      size: asNullableString(extracted.size),
      configuration: asNullableString(extracted.configuration),
      edition: asNullableString(extracted.edition),
      generation: asNullableString(extracted.generation),
      sku: asNullableString(extracted.sku),
      gtin: asNullableString(extracted.gtin),
      upc: asNullableString(extracted.upc),
      ean: asNullableString(extracted.ean),
      variant: asNullableString(extracted.variant),
      extractedAt: new Date().toISOString()
    };
  }
};
