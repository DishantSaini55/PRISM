"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { untrackProduct } from "@/app/actions";

export default function UntrackProductButton({ productId }) {
  const [isPending, startTransition] = useTransition();

  function untrack() {
    if (!window.confirm("Stop tracking this product? Your saved history will remain available if you add it again.")) {
      return;
    }

    startTransition(async () => {
      const result = await untrackProduct(productId);
      if (result.error) toast.error(result.error);
      else toast.success("Product is no longer being tracked.");
    });
  }

  return (
    <button
      type="button"
      onClick={untrack}
      disabled={isPending}
      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-60"
      aria-label="Stop tracking product"
      title="Stop tracking"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
