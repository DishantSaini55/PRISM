"use client";

import { useState, useTransition } from "react";
import { Link2Off, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { createProductShare, revokeProductShare } from "@/app/actions";

export default function ShareProductButton({ productId }) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  function share(expiryDays) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("expiryDays", String(expiryDays));

    startTransition(async () => {
      const result = await createProductShare(formData);
      if (result.error) return toast.error(result.error);

      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Read-only share link copied.");
      } catch {
        window.prompt("Copy this read-only share link:", result.url);
      }
      setIsOpen(false);
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeProductShare(productId);
      if (result.error) return toast.error(result.error);
      toast.success(result.message);
      setIsOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-60"
        aria-label="Manage read-only share link"
        title="Share comparison"
      >
        <Share2 className="h-4 w-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-7 z-20 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">Share comparison</p><button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Creates a read-only link with current verified offers.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={isPending} onClick={() => share(1)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">1 day</button>
            <button type="button" disabled={isPending} onClick={() => share(7)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">7 days</button>
            <button type="button" disabled={isPending} onClick={() => share(30)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">30 days</button>
            <button type="button" disabled={isPending} onClick={() => share(0)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">No expiry</button>
          </div>
          <button type="button" disabled={isPending} onClick={revoke} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-60"><Link2Off className="h-3.5 w-3.5" /> Revoke active link</button>
        </div>
      )}
    </div>
  );
}
