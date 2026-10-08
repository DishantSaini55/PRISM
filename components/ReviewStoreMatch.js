"use client";

import { useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { reviewStoreMatch } from "@/app/actions";

export default function ReviewStoreMatch({ productId, source }) {
  const [isPending, startTransition] = useTransition();

  function submit(decision) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("sourceId", source.id);
    formData.set("decision", decision);

    startTransition(async () => {
      const result = await reviewStoreMatch(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">
            Review {source.store?.name || "store"} match
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            This looks similar, but PRISM could not verify the exact variant. Open the listing and approve it only if the model, RAM/storage, and colour match.
          </p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-100"
          aria-label="Open candidate store listing"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-slate-700">{source.source_name || source.url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("approve")}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" /> Same product
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("reject")}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" /> Not the same
        </button>
      </div>
    </div>
  );
}
