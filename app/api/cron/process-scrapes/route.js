import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  claimScrapingJobs,
  completeScrapingJob,
  failScrapingJob
} from "@/lib/jobs";
import { collectPrice, recordPriceObservation } from "@/lib/pricing";
import { enqueueTargetPriceNotifications } from "@/lib/alerts";
import { persistRecommendationForSource } from "@/lib/recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
}

function errorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown scraping error.";
  return message.slice(0, 1000);
}

async function processScrapingJobs(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const jobs = await claimScrapingJobs(supabase, 5);
    const results = {
      claimed: jobs.length,
      completed: 0,
      retrying: 0,
      failed: 0,
      notificationsCreated: 0,
      recommendationsCreated: 0
    };

    // Process serially to respect retailer limits and avoid spending an
    // uncontrolled number of Firecrawl credits in one invocation.
    for (const job of jobs) {
      try {
        const { data: source, error: sourceError } = await supabase
          .from("product_sources")
          .select("id, url")
          .eq("id", job.product_source_id)
          .single();

        if (sourceError || !source) {
          throw new Error(sourceError?.message || "Product source was not found.");
        }

        const observation = await collectPrice(source);
        await recordPriceObservation(supabase, observation);
        results.notificationsCreated += await enqueueTargetPriceNotifications(
          supabase,
          observation
        );
        try {
          const recommendation = await persistRecommendationForSource(
            supabase,
            source.id
          );
          if (recommendation) results.recommendationsCreated += 1;
        } catch (recommendationError) {
          // A recommendation is derived data. Preserve the successful price
          // observation and retry it on the next refresh if derivation fails.
          console.error(
            `Recommendation for scraping job ${job.job_id} failed:`,
            recommendationError
          );
        }
        await completeScrapingJob(supabase, job.job_id, "SUCCESS");
        results.completed += 1;
      } catch (error) {
        console.error(`Scraping job ${job.job_id} failed:`, error);

        try {
          const status = await failScrapingJob(
            supabase,
            job.job_id,
            errorMessage(error)
          );

          if (status === "RETRYING") {
            results.retrying += 1;
          } else {
            results.failed += 1;
          }
        } catch (jobError) {
          console.error(`Unable to update scraping job ${job.job_id}:`, jobError);
          results.failed += 1;
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Scraping worker failed:", error);
    return NextResponse.json(
      { error: "Unable to process scraping jobs." },
      { status: 500 }
    );
  }
}

export const GET = processScrapingJobs;
export const POST = processScrapingJobs;
