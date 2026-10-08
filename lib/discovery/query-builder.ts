import type { NormalizedProduct } from "@/lib/products";

export function buildDiscoveryQuery(product: NormalizedProduct) {
  return [product.brand, product.model, product.storage, product.ram, product.color]
    .filter(Boolean)
    .join(" ")
    .slice(0, 160);
}
