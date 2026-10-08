import type { PriceObservation } from "./types";

interface PriceHistoryRpcClient {
  rpc(
    functionName: string,
    args: Record<string, string | number>
  ): Promise<{ data: string | null; error: { message: string } | null }>;
}

export async function recordPriceObservation(
  client: PriceHistoryRpcClient,
  observation: PriceObservation
) {
  const { data: historyId, error } = await client.rpc(
    "record_price_observation",
    {
      p_product_source_id: observation.productSourceId,
      p_price: observation.price,
      p_currency: observation.currency,
      p_availability: observation.availability,
      p_checked_at: observation.checkedAt
    }
  );

  if (error) {
    throw new Error(`Unable to record price observation: ${error.message}`);
  }

  if (!historyId) {
    throw new Error("Price observation did not return a history ID.");
  }

  return historyId;
}
