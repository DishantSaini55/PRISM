import { firecrawlDiscoveryProvider } from "./firecrawl";
import type { ProductSearchCandidate } from "./types";

export async function discoverProducts(
  query: string
): Promise<ProductSearchCandidate[]> {
  return firecrawlDiscoveryProvider.search(query);
}
