import { firecrawlDiscoveryProvider } from "./firecrawl";
import type { ProductSearchCandidate, StoreSearchTarget } from "./types";

export async function discoverProducts(
  query: string,
  stores: StoreSearchTarget[]
): Promise<ProductSearchCandidate[]> {
  if (stores.length === 0) {
    throw new Error("No active stores are configured for product discovery.");
  }

  return firecrawlDiscoveryProvider.search(query, stores);
}
