import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendNotificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
}

function safeError(error) {
  return (error instanceof Error ? error.message : "Email delivery failed.").slice(0, 1000);
}

async function deliverNotifications(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Resend is not configured." }, { status: 503 });
  }

  try {
    const admin = createAdminClient();
    const { data: notifications, error } = await admin.rpc("claim_email_notifications", { p_limit: 10 });
    if (error) throw error;
    const results = { claimed: notifications?.length || 0, sent: 0, failed: 0 };

    for (const notification of notifications || []) {
      try {
        const sourceId = notification.payload?.product_source_id;
        const { data: source, error: sourceError } = await admin
          .from("product_sources")
          .select("url, store:stores(name), product:products(name)")
          .eq("id", sourceId)
          .maybeSingle();
        if (sourceError) throw sourceError;

        await sendNotificationEmail({
          to: notification.user_email,
          payload: notification.payload,
          product: source?.product,
          source
        });
        const { error: finishError } = await admin.rpc("finish_email_notification", {
          p_notification_id: notification.notification_id,
          p_claimed_at: notification.claimed_at,
          p_delivered: true,
          p_error: null
        });
        if (finishError) throw finishError;
        results.sent += 1;
      } catch (deliveryError) {
        console.error("Email notification delivery failed:", deliveryError);
        await admin.rpc("finish_email_notification", {
          p_notification_id: notification.notification_id,
          p_claimed_at: notification.claimed_at,
          p_delivered: false,
          p_error: safeError(deliveryError)
        });
        results.failed += 1;
      }
    }
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Notification delivery worker failed:", error);
    return NextResponse.json({ error: "Unable to deliver notifications." }, { status: 500 });
  }
}

export const GET = deliverNotifications;
export const POST = deliverNotifications;
