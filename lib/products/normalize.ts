import type { ProductData } from "@/lib/scrapers";

import type { NormalizedProduct } from "./types";

function normalizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeStorage(value: string | null, name: string | null) {
  const source = normalizeText(value) ?? normalizeText(name);

  if (!source) {
    return null;
  }

  const match = source.match(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/i);

  if (!match) {
    return null;
  }

  return `${match[1]}${match[2].toUpperCase()}`;
}

function toKeyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildCanonicalKey({
  brand,
  model,
  storage,
  color,
  variant
}: Omit<NormalizedProduct, "source" | "name" | "category" | "canonicalKey">) {
  // Storage is required before generating a key to avoid merging 128GB and 256GB variants.
  if (!brand || !model || !storage) {
    return null;
  }

  const parts = [
    `brand:${toKeyPart(brand)}`,
    `model:${toKeyPart(model)}`,
    `storage:${toKeyPart(storage)}`
  ];

  if (color) {
    parts.push(`color:${toKeyPart(color)}`);
  }

  if (variant) {
    parts.push(`variant:${toKeyPart(variant)}`);
  }

  return parts.join("|");
}

export function normalizeProductData(product: ProductData): NormalizedProduct {
  const name = normalizeText(product.name);
  const brand = normalizeText(product.brand);
  const model = normalizeText(product.model);
  const category = normalizeText(product.category)?.toLowerCase() ?? null;
  const color = normalizeText(product.color);
  const variant = normalizeText(product.variant);
  const storage = normalizeStorage(product.storage, name);

  return {
    source: product,
    name,
    brand,
    model,
    category,
    storage,
    color,
    variant,
    canonicalKey: buildCanonicalKey({
      brand,
      model,
      storage,
      color,
      variant
    })
  };
}
