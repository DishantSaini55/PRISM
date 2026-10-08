import { scrapeProduct } from "@/lib/scrapers";
import type { StoreProvider } from "./types";

function provider(id: StoreProvider["id"], name: string, domains: string[]): StoreProvider {
  return {
    id,
    name,
    domains,
    canHandle(url) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
      } catch {
        return false;
      }
    },
    extractProduct: scrapeProduct
  };
}

export const storeProviders = [
  provider("amazon-india", "Amazon India", ["amazon.in"]),
  provider("flipkart", "Flipkart", ["flipkart.com"]),
  provider("croma", "Croma", ["croma.com"]),
  provider("reliance-digital", "Reliance Digital", ["reliancedigital.in"])
] as const;

export function getStoreProvider(url: string) {
  return storeProviders.find((candidate) => candidate.canHandle(url)) ?? null;
}
