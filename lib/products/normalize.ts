import type { ProductData } from "@/lib/scrapers";

import type { NormalizedProduct } from "./types";

function normalizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeCapacity(value: string | null, name: string | null, kind: "storage" | "ram") {
  const source = normalizeText(value) ?? normalizeText(name);

  if (!source) {
    return null;
  }

  const matches = [...source.matchAll(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/gi)];
  if (matches.length === 0) return null;
  const ram = source.match(/\b(\d+(?:\.\d+)?)\s*gb\s*ram\b/i);
  if (kind === "ram") return ram ? `${ram[1]}GB` : null;
  const explicitStorage = source.match(/(?:storage|rom|internal memory)\D{0,12}(\d+(?:\.\d+)?)\s*(gb|tb)\b/i);
  if (explicitStorage) return `${explicitStorage[1]}${explicitStorage[2].toUpperCase()}`;
  return matches
    .map((match) => ({
      value: Number(match[1]) * (match[2].toLowerCase() === "tb" ? 1024 : 1),
      text: `${match[1]}${match[2].toUpperCase()}`
    }))
    .sort((left, right) => right.value - left.value)[0].text;
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
}: Pick<NormalizedProduct, "brand" | "model" | "storage" | "color" | "variant">) {
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
  const storage = normalizeCapacity(product.storage, name, "storage");
  const ram = normalizeCapacity(product.ram, name, "ram");

  return {
    source: product,
    name,
    brand,
    model,
    category,
    storage,
    ram,
    size: normalizeText(product.size),
    configuration: normalizeText(product.configuration),
    edition: normalizeText(product.edition),
    generation: normalizeText(product.generation),
    identifiers: {
      gtin: normalizeText(product.gtin),
      upc: normalizeText(product.upc),
      ean: normalizeText(product.ean)
    },
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
