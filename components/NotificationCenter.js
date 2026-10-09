"use client";

import { useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";

function formatPrice(price, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2
    }).format(Number(price));
  } catch {
    return `${currency || ""} ${price}`.trim();
  }
}

function notificationText(notification) {
  const payload = notification.payload || {};
  if (payload.alert_type === "PRICE_DROP") {
    return `Price dropped ${Number(payload.percentage_drop || 0).toFixed(1)}% to ${formatPrice(payload.price, payload.currency)}.`;
  }
  if (payload.alert_type === "BACK_IN_STOCK") {
    return `A tracked listing is back in stock at ${formatPrice(payload.price, payload.currency)}.`;
  }
  if (payload.alert_type === "ALL_TIME_LOW") {
    return `New all-time low: ${formatPrice(payload.price, payload.currency)}.`;
  }
  return `Target reached: ${formatPrice(payload.price, payload.currency)} (target ${formatPrice(payload.target_price, payload.currency)}).`;
}

export default function NotificationCenter({ notifications, unreadCount }) {
  const [isPending, startTransition] = useTransition();

  function markOneRead(notificationId) {
    startTransition(async () => {
      const result = await markNotificationRead(notificationId);
      if (result.error) toast.error(result.error);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) toast.error(result.error);
      else toast.success("Notifications marked as read.");
    });
  }

  if (notifications.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-700" />
          <h2 className="text-sm font-semibold text-indigo-950">Price alerts</h2>
          {unreadCount > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">{unreadCount}</span>}
        </div>
        {unreadCount > 0 && (
          <button type="button" disabled={isPending} onClick={markAllRead} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-60">
            <CheckCheck className="mr-1 inline h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {notifications.map((notification) => (
          <li key={notification.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${notification.read_at ? "border-slate-100 bg-white text-slate-600" : "border-indigo-200 bg-white text-slate-800 shadow-sm"}`}>
            <div>
              <p>{notificationText(notification)}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            {!notification.read_at && (
              <button type="button" disabled={isPending} onClick={() => markOneRead(notification.id)} className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-60">
                Read
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
