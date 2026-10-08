export interface ProductSearchCandidate {
  title: string;
  url: string;
  storeName: string;
  description: string | null;
  imageUrl: string | null;
}

export interface ProductDiscoveryProvider {
  readonly name: string;
  search(query: string): Promise<ProductSearchCandidate[]>;
}
