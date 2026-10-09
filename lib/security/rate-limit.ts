interface RateLimitClient {
  rpc<T>(
    functionName: string,
    args: Record<string, string | number>
  ): Promise<{ data: T; error: { message: string } | null }>;
}

export async function consumeRateLimit(
  client: RateLimitClient,
  subjectKey: string,
  action: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await client.rpc<boolean>("consume_request_rate_limit", {
    p_subject_key: subjectKey,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });

  if (error || data === null) {
    throw new Error(error?.message || "Unable to verify the request limit.");
  }

  return data;
}
