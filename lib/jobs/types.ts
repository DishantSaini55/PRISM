export type ScrapingJobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING";

export interface ClaimedScrapingJob {
  job_id: string;
  product_source_id: string;
  attempt: number;
  max_attempts: number;
  created_at: string;
}
