import { createFirecrawlClient } from "@/lib/firecrawl-client";

import type { ProductDiscoveryProvider, ProductSearchCandidate } from "./types";

function toCandidate(document: {
  url?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): ProductSearchCandidate | null {
  const url = document.url ?? document.metadata?.sourceURL;

  if (typeof url !== "string") {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const title =
      document.title ??
      (typeof document.metadata?.title === "string"
        ? document.metadata.title
        : null) ??
      parsedUrl.hostname;
    const storeName =
      typeof document.metadata?.ogSiteName === "string"
        ? document.metadata.ogSiteName
        : parsedUrl.hostname.replace(/^www\./, "");

    return {
      title,
      url: parsedUrl.toString(),
      storeName,
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

  async search(query) {
    const result = await createFirecrawlClient().search(query, {
      limit: 6,
      country: "IN",
      lang: "en"
    });

    if (!result.success) {
      throw new Error(result.error || "Product search failed.");
    }

    const uniqueUrls = new Set<string>();

    return result.data.reduce<ProductSearchCandidate[]>((candidates, document) => {
      const candidate = toCandidate(document);

      if (!candidate || uniqueUrls.has(candidate.url)) {
        return candidates;
      }

      uniqueUrls.add(candidate.url);
      candidates.push(candidate);
      return candidates;
    }, []);
  }
};
