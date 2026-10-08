import type { NormalizedProduct } from "./types";

export type ProductMatchClassification =
  | "SAME_PRODUCT"
  | "POTENTIAL_MATCH"
  | "DIFFERENT_PRODUCT";

type MatchField = "brand" | "model" | "storage" | "color" | "variant" | "category";

export interface ProductMatchSignal {
  field: MatchField;
  weight: number;
  score: number | null;
  left: string | null;
  right: string | null;
}

export interface ProductMatchResult {
  confidence: number;
  classification: ProductMatchClassification;
  signals: ProductMatchSignal[];
  blockingReasons: string[];
}

const fieldWeights: Record<MatchField, number> = {
  brand: 25,
  model: 35,
  storage: 20,
  color: 5,
  variant: 10,
  category: 5
};

function comparable(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? null;
}

function exactSimilarity(left: string | null, right: string | null) {
  const normalizedLeft = comparable(left);
  const normalizedRight = comparable(right);

  if (!normalizedLeft || !normalizedRight) {
    return null;
  }

  return normalizedLeft === normalizedRight ? 1 : 0;
}

function modelSimilarity(left: string | null, right: string | null) {
  const normalizedLeft = comparable(left);
  const normalizedRight = comparable(right);

  if (!normalizedLeft || !normalizedRight) {
    return null;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token));
  const totalTokens = new Set([...leftTokens, ...rightTokens]).size;

  return totalTokens === 0 ? 0 : sharedTokens.length / totalTokens;
}

function createSignal(
  field: MatchField,
  left: string | null,
  right: string | null,
  similarity: (left: string | null, right: string | null) => number | null
): ProductMatchSignal {
  return {
    field,
    weight: fieldWeights[field],
    score: similarity(left, right),
    left,
    right
  };
}

export function matchProducts(
  left: NormalizedProduct,
  right: NormalizedProduct
): ProductMatchResult {
  const signals = [
    createSignal("brand", left.brand, right.brand, exactSimilarity),
    createSignal("model", left.model, right.model, modelSimilarity),
    createSignal("storage", left.storage, right.storage, exactSimilarity),
    createSignal("color", left.color, right.color, exactSimilarity),
    createSignal("variant", left.variant, right.variant, exactSimilarity),
    createSignal("category", left.category, right.category, exactSimilarity)
  ];

  const observedSignals = signals.filter((signal) => signal.score !== null);
  const observedWeight = observedSignals.reduce(
    (total, signal) => total + signal.weight,
    0
  );
  const weightedScore = observedSignals.reduce(
    (total, signal) => total + signal.weight * (signal.score ?? 0),
    0
  );
  const confidence = observedWeight
    ? Math.round((weightedScore / observedWeight) * 10000) / 100
    : 0;

  const blockingReasons: string[] = [];
  const brandSignal = signals.find((signal) => signal.field === "brand");
  const modelSignal = signals.find((signal) => signal.field === "model");
  const storageSignal = signals.find((signal) => signal.field === "storage");
  const colorSignal = signals.find((signal) => signal.field === "color");
  const variantSignal = signals.find((signal) => signal.field === "variant");

  if (brandSignal?.score === 0) {
    blockingReasons.push("Brand differs.");
  }

  if (storageSignal?.score === 0) {
    blockingReasons.push("Storage differs.");
  }

  if (variantSignal?.score === 0) {
    blockingReasons.push("Variant differs.");
  }

  const hasHardConflict = blockingReasons.length > 0;
  const hasCompleteIdentity =
    brandSignal?.score === 1 &&
    modelSignal?.score === 1 &&
    storageSignal?.score === 1;
  const hasColorConflict = colorSignal?.score === 0;

  let classification: ProductMatchClassification;

  if (hasHardConflict || (modelSignal?.score != null && modelSignal.score < 0.5)) {
    classification = "DIFFERENT_PRODUCT";
  } else if (hasCompleteIdentity && !hasColorConflict && confidence >= 95) {
    classification = "SAME_PRODUCT";
  } else if (confidence >= 80 || hasCompleteIdentity || hasColorConflict) {
    classification = "POTENTIAL_MATCH";
  } else {
    classification = "DIFFERENT_PRODUCT";
  }

  if (hasColorConflict && classification !== "DIFFERENT_PRODUCT") {
    blockingReasons.push("Color differs and requires review.");
  }

  return {
    confidence,
    classification,
    signals,
    blockingReasons
  };
}
