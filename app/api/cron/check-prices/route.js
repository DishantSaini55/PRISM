import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scheduleDueScrapes } from "@/lib/jobs";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
}

async function schedulePriceChecks(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server-side Supabase credentials are not configured." },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const queued = await scheduleDueScrapes(supabase);

    return NextResponse.json({
      success: true,
      message: "Due price checks queued.",
      queued
    });
  } catch (error) {
    console.error("Price-check scheduling failed:", error);
    return NextResponse.json(
      { error: "Unable to queue due price checks." },
      { status: 500 }
    );
  }
}

// Vercel Cron invokes GET requests. POST is retained for manual, authenticated
// triggering from a trusted scheduler.
export const GET = schedulePriceChecks;
export const POST = schedulePriceChecks;
