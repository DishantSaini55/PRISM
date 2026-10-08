export interface ProductSearchCandidate {
  title: string;
  url: string;
  storeName: string;
  description: string | null;
  imageUrl: string | null;
}

export interface StoreSearchTarget {
  name: string;
  domain: string;
}

export interface ProductDiscoveryProvider {
  readonly name: string;
  search(
    query: string,
    stores: StoreSearchTarget[]
  ): Promise<ProductSearchCandidate[]>;
}
