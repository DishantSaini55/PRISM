import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return `${currency || ""} ${value ?? ""}`.trim();
  }
}

function alertTitle(type) {
  return {
    TARGET_REACHED: "Target price reached",
    PRICE_DROP: "Price drop detected",
    BACK_IN_STOCK: "Back in stock",
    ALL_TIME_LOW: "New all-time low"
  }[type] || "Price update";
}

function errorMessage(error) {
  return (error instanceof Error ? error.message : "Telegram delivery failed.").slice(0, 1000);
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.description || "Telegram rejected the message.");
}

async function deliverTelegram(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "Telegram is not configured." }, { status: 503 });

  try {
    const admin = createAdminClient();
    const { data: notifications, error } = await admin.rpc("claim_telegram_notifications", { p_limit: 10 });
    if (error) throw error;
    const results = { claimed: notifications?.length || 0, sent: 0, failed: 0 };

    for (const notification of notifications || []) {
      try {
        const { data: source, error: sourceError } = await admin
          .from("product_sources")
          .select("url, store:stores(name), product:products(name)")
          .eq("id", notification.payload?.product_source_id)
          .maybeSingle();
        if (sourceError) throw sourceError;
        const productName = (source?.product?.name || "Tracked product").slice(0, 500);
        const storeName = (source?.store?.name || "Store listing").slice(0, 120);
        const text = [
          `PRISM — ${alertTitle(notification.payload?.alert_type)}`,
          productName,
          `${storeName}: ${formatPrice(notification.payload?.price, notification.payload?.currency)}`,
          source?.url || process.env.NEXT_PUBLIC_APP_URL || ""
        ].filter(Boolean).join("\n");
        await sendTelegramMessage(notification.chat_id, text);
        const { error: finishError } = await admin.rpc("finish_telegram_notification", {
          p_notification_id: notification.notification_id,
          p_claimed_at: notification.claimed_at,
          p_delivered: true,
          p_error: null
        });
        if (finishError) throw finishError;
        results.sent += 1;
      } catch (deliveryError) {
        console.error("Telegram notification delivery failed:", deliveryError);
        await admin.rpc("finish_telegram_notification", {
          p_notification_id: notification.notification_id,
          p_claimed_at: notification.claimed_at,
          p_delivered: false,
          p_error: errorMessage(deliveryError)
        });
        results.failed += 1;
      }
    }
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Telegram worker failed:", error);
    return NextResponse.json({ error: "Unable to deliver Telegram notifications." }, { status: 500 });
  }
}

export const GET = deliverTelegram;
export const POST = deliverTelegram;
