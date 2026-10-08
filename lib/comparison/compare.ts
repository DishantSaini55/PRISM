import type {
  ComparedStoreOffer,
  CurrencyComparison,
  StoreComparison,
  StoreOffer
} from "./types";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function toComparedOffer(offer: StoreOffer): ComparedStoreOffer {
  const price = offer.price;
  const mrp = offer.mrp;
  const hasValidMrp =
    price !== null && mrp !== null && mrp >= price;
  const discountAmount = hasValidMrp ? mrp - price : null;
  const discountPercentage =
    discountAmount !== null && mrp !== null && mrp > 0
      ? round((discountAmount / mrp) * 100)
      : null;

  return {
    ...offer,
    discountAmount: discountAmount === null ? null : round(discountAmount),
    discountPercentage
  };
}

export function compareStoreOffers(offers: StoreOffer[]): StoreComparison {
  const comparedOffers = offers.map(toComparedOffer);
  const availableOffers = comparedOffers.filter(
    (offer) =>
      offer.availability === "IN_STOCK" &&
      offer.price !== null &&
      offer.currency !== null
  );
  const unavailableOffers = comparedOffers.filter(
    (offer) => !availableOffers.includes(offer)
  );
  const offersByCurrency = new Map<string, ComparedStoreOffer[]>();

  for (const offer of availableOffers) {
    const currency = offer.currency?.toUpperCase();

    if (!currency) {
      continue;
    }

    offersByCurrency.set(currency, [...(offersByCurrency.get(currency) ?? []), offer]);
  }

  const currencyComparisons: CurrencyComparison[] = [...offersByCurrency.entries()]
    .map(([currency, currencyOffers]) => {
      const sortedOffers = [...currencyOffers].sort(
        (left, right) => (left.price ?? Infinity) - (right.price ?? Infinity)
      );

      return {
        currency,
        offers: sortedOffers,
        bestOffer: sortedOffers[0]
      };
    })
    .sort((left, right) => left.currency.localeCompare(right.currency));

  return {
    currencyComparisons,
    bestOffer:
      currencyComparisons.length === 1 ? currencyComparisons[0].bestOffer : null,
    unavailableOffers
  };
}
