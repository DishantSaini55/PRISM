"use client";

import { useEffect, useState } from "react";
import { BarChart3, Eye } from "lucide-react";
import { getProductShareAnalytics } from "@/app/actions";

function timeAgo(value) {
  if (!value) return "No views yet";
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000));
  return hours < 1 ? "Viewed just now" : hours < 24 ? `Viewed ${hours}h ago` : `Viewed ${Math.round(hours / 24)}d ago`;
}

export default function ShareAnalytics({ productId }) {
  const [result, setResult] = useState(null);
  useEffect(() => { getProductShareAnalytics(productId).then(setResult); }, [productId]);
  if (!result || result.error) return null;

  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><BarChart3 className="h-4 w-4 text-indigo-600" /> Share analytics</h2>
      {!result.hasShare ? <p className="mt-2 text-xs text-slate-500">Create a read-only link to see private view totals here.</p> : (
        <div className="mt-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-indigo-600" /><p className="text-sm font-semibold text-slate-900">{result.totalViews} total views</p></div>
          <p className="mt-1 text-xs text-slate-600">{result.viewsLast7Days} in the last 7 days · {timeAgo(result.lastViewedAt)}</p>
          {!result.isActive && <p className="mt-2 text-xs font-medium text-amber-700">This share link is no longer active.</p>}
        </div>
      )}
    </section>
  );
}
