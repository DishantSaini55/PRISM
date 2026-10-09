"use client";

import { useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { retryScrapeJob } from "@/app/actions";

const statusStyles = {
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  RETRYING: "bg-amber-100 text-amber-800",
  RUNNING: "bg-sky-100 text-sky-800",
  PENDING: "bg-slate-100 text-slate-700"
};

export default function ScrapeHealthPanel({ jobs }) {
  const [isPending, startTransition] = useTransition();
  const failedCount = jobs.filter((job) => job.status === "FAILED").length;

  function retry(job) {
    const formData = new FormData();
    formData.set("productId", job.product_id);
    formData.set("productSourceId", job.product_source_id);
    startTransition(async () => {
      const result = await retryScrapeJob(formData);
      if (result.error) toast.error(result.error);
      else toast.success("Price check queued for retry.");
    });
  }

  if (jobs.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Clock3 className="h-4 w-4 text-indigo-600" /> Price-check health</h2><p className="mt-1 text-xs text-slate-500">Latest scheduled and manual checks for your offers.</p></div>
        {failedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800"><AlertTriangle className="h-3.5 w-3.5" /> {failedCount} failed</span>}
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {jobs.slice(0, 6).map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{job.store_name || "Store listing"}</p><p className="mt-1 truncate text-xs text-slate-500">{job.error || `Attempt ${job.attempt}/${job.max_attempts}`}</p></div>
            <div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[job.status] || statusStyles.PENDING}`}>{job.status}</span>{job.status === "FAILED" && <button type="button" disabled={isPending} onClick={() => retry(job)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"><RotateCw className="h-3.5 w-3.5" /> Retry</button>}{job.status === "SUCCESS" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
