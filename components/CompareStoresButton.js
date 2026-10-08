"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { compareStoreOffers } from "@/app/actions";

export default function CompareStoresButton({ productId }) {
  const [isPending, startTransition] = useTransition();

  function compare() {
    const formData = new FormData();
    formData.set("productId", productId);

    startTransition(async () => {
      const result = await compareStoreOffers(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Checked ${result.checked} listing${result.checked === 1 ? "" : "s"}; added ${result.added} verified offer${result.added === 1 ? "" : "s"}.`
      );

      if (result.potential > 0) {
        toast.info(`${result.potential} possible match${result.potential === 1 ? " needs" : "es need"} review and was not added.`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={compare}
      disabled={isPending}
      className="flex items-center gap-1 rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Comparing..." : "Compare stores"}
    </button>
  );
}
