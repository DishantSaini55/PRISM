import type { PriceObservation } from "@/lib/pricing";

interface NotificationRpcClient {
  rpc<T>(
    functionName: string,
    args: Record<string, string | number>
  ): Promise<{ data: T; error: { message: string } | null }>;
}

export async function enqueueTargetPriceNotifications(
  client: NotificationRpcClient,
  observation: PriceObservation
) {
  const { data, error } = await client.rpc<number>(
    "enqueue_target_price_notifications",
    {
      p_product_source_id: observation.productSourceId,
      p_price: observation.price,
      p_currency: observation.currency,
      p_availability: observation.availability,
      p_checked_at: observation.checkedAt
    }
  );

  if (error || data === null) {
    throw new Error(error?.message || "Unable to create target notifications.");
  }

  return data;
}
