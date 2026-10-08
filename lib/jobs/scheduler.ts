interface SchedulerRpcClient {
  rpc<T>(
    functionName: string,
    args: Record<string, number>
  ): Promise<{ data: T; error: { message: string } | null }>;
}

export async function scheduleDueScrapes(
  client: SchedulerRpcClient,
  minimumIntervalHours = 24
) {
  const { data, error } = await client.rpc<number>("schedule_due_scrapes", {
    p_minimum_interval_hours: minimumIntervalHours
  });

  if (error || data === null) {
    throw new Error(error?.message || "Unable to schedule due scrapes.");
  }

  return data;
}
