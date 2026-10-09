"use client";

import { useTransition } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { createProductShare } from "@/app/actions";

export default function ShareProductButton({ productId }) {
  const [isPending, startTransition] = useTransition();

  function share() {
    startTransition(async () => {
      const result = await createProductShare(productId);
      if (result.error) return toast.error(result.error);

      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Read-only share link copied.");
      } catch {
        window.prompt("Copy this read-only share link:", result.url);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={isPending}
      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-60"
      aria-label="Copy a read-only share link"
      title="Share comparison"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
