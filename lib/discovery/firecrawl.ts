import { createFirecrawlClient } from "@/lib/firecrawl-client";

import type {
  ProductDiscoveryProvider,
  ProductSearchCandidate,
  StoreSearchTarget
} from "./types";

function toCandidate(document: {
  url?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}, store: StoreSearchTarget): ProductSearchCandidate | null {
  const url = document.url ?? document.metadata?.sourceURL;

  if (typeof url !== "string") {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const storeDomain = store.domain.toLowerCase();

    if (hostname !== storeDomain && !hostname.endsWith(`.${storeDomain}`)) {
      return null;
    }

    const title =
      document.title ??
      (typeof document.metadata?.title === "string"
        ? document.metadata.title
        : null) ??
      parsedUrl.hostname;
    return {
      title,
      url: parsedUrl.toString(),
      storeName: store.name,
      description: document.description ?? null,
      imageUrl:
        typeof document.metadata?.ogImage === "string"
          ? document.metadata.ogImage
          : null
    };
  } catch {
    return null;
  }
}

export const firecrawlDiscoveryProvider: ProductDiscoveryProvider = {
  name: "firecrawl",

  async search(query, stores) {
    const firecrawl = createFirecrawlClient();
    const results = await Promise.allSettled(
      stores.map(async (store) => {
        const result = await firecrawl.search(`${query} site:${store.domain}`, {
          limit: 3,
          country: "IN",
          lang: "en"
        });

        if (!result.success) {
          throw new Error(result.error || `Search failed for ${store.name}.`);
        }

        return result.data.reduce<ProductSearchCandidate[]>((candidates, document) => {
          const candidate = toCandidate(document, store);

          if (candidate) {
            candidates.push(candidate);
          }

          return candidates;
        }, []);
      })
    );

    const uniqueUrls = new Set<string>();

    return results.flatMap((result) => {
      if (result.status !== "fulfilled") {
        return [];
      }

      return result.value.filter((candidate) => {
        if (uniqueUrls.has(candidate.url)) {
          return false;
        }

        uniqueUrls.add(candidate.url);
        return true;
      });
    });
  }
};
