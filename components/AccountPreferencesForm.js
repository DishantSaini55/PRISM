"use client";

import { useState, useTransition } from "react";
import { Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { saveAccountPreferences } from "@/app/actions";

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];

export default function AccountPreferencesForm({ profile, preferences }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [timezone, setTimezone] = useState(preferences?.timezone || "Asia/Kolkata");
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(preferences?.email_alerts_enabled ?? true);
  const [browserPushEnabled, setBrowserPushEnabled] = useState(preferences?.browser_push_enabled ?? false);
  const [isPending, startTransition] = useTransition();

  function save(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("timezone", timezone);
    formData.set("emailAlertsEnabled", String(emailAlertsEnabled));
    formData.set("browserPushEnabled", String(browserPushEnabled));
    startTransition(async () => {
      const result = await saveAccountPreferences(formData);
      if (result.error) return toast.error(result.error);
      toast.success("Preferences saved.");
    });
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-semibold text-slate-950">Profile and alerts</h2></div>
      <label className="block text-sm font-medium text-slate-700">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Your name" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-indigo-200 focus:ring-2" /></label>
      <label className="block text-sm font-medium text-slate-700">Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-indigo-200 focus:ring-2">{TIMEZONES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3"><input type="checkbox" checked={emailAlertsEnabled} onChange={(event) => setEmailAlertsEnabled(event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-medium text-slate-900">Email alert preference</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Saved now; email delivery stays off until an email provider is configured.</span></span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3"><input type="checkbox" checked={browserPushEnabled} onChange={(event) => setBrowserPushEnabled(event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-medium text-slate-900">Browser push preference</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Saved for future browser notification setup.</span></span></label>
      <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Save className="h-4 w-4" /> {isPending ? "Saving…" : "Save preferences"}</button>
    </form>
  );
}
