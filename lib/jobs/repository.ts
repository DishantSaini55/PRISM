import type { ClaimedScrapingJob } from "./types";

interface JobRpcClient {
  rpc<T>(
    functionName: string,
    args: Record<string, string | number | null>
  ): Promise<{ data: T; error: { message: string } | null }>;
}

export async function enqueueScrapingJob(
  client: JobRpcClient,
  productSourceId: string
) {
  const { data, error } = await client.rpc<string>("enqueue_scraping_job", {
    p_product_source_id: productSourceId
  });

  if (error || !data) {
    throw new Error(error?.message || "Unable to enqueue scraping job.");
  }

  return data;
}

export async function claimScrapingJobs(client: JobRpcClient, limit = 5) {
  const { data, error } = await client.rpc<ClaimedScrapingJob[]>(
    "claim_scraping_jobs",
    { p_limit: limit }
  );

  if (error) {
    throw new Error(`Unable to claim scraping jobs: ${error.message}`);
  }

  return data ?? [];
}

export async function completeScrapingJob(
  client: JobRpcClient,
  jobId: string,
  status: "SUCCESS" | "FAILED",
  errorMessage: string | null = null
) {
  const { error } = await client.rpc<null>("complete_scraping_job", {
    p_job_id: jobId,
    p_status: status,
    p_error: errorMessage
  });

  if (error) {
    throw new Error(`Unable to complete scraping job: ${error.message}`);
  }
}

export async function failScrapingJob(
  client: JobRpcClient,
  jobId: string,
  errorMessage: string
) {
  const { data, error } = await client.rpc<"RETRYING" | "FAILED">(
    "fail_scraping_job",
    {
      p_job_id: jobId,
      p_error: errorMessage
    }
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to record scraping job failure.");
  }

  return data;
}
