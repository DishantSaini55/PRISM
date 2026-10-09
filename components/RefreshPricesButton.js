"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshProductPrices } from "@/app/actions";

export default function RefreshPricesButton({ productId }) {
  const [isPending, startTransition] = useTransition();

  function refresh() {
    const formData = new FormData();
    formData.set("productId", productId);

    startTransition(async () => {
      const result = await refreshProductPrices(formData);
      if (result.error) return toast.error(result.error);
      toast.success(
        `Checked ${result.checked} offer${result.checked === 1 ? "" : "s"}; updated ${result.updated}.`
      );
      if (result.failed > 0) toast.info(`${result.failed} offer${result.failed === 1 ? "" : "s"} could not be refreshed.`);
    });
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Checking..." : "Check now"}
    </button>
  );
}
