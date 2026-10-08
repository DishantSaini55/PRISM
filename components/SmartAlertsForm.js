"use client";

import { useState, useTransition } from "react";
import { BellRing, PackageCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearSmartAlert, saveSmartAlert } from "@/app/actions";

export default function SmartAlertsForm({ productId, initialPriceDrop, initialBackInStock }) {
  const [percentage, setPercentage] = useState(
    initialPriceDrop?.percentage_drop ? String(initialPriceDrop.percentage_drop) : ""
  );
  const [isPending, startTransition] = useTransition();

  function save(alertType) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("alertType", alertType);
    if (alertType === "PRICE_DROP") formData.set("percentageDrop", percentage);

    startTransition(async () => {
      const result = await saveSmartAlert(formData);
      if (result.error) return toast.error(result.error);
      toast.success(result.message);
    });
  }

  function clear(alertType) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("alertType", alertType);

    startTransition(async () => {
      const result = await clearSmartAlert(formData);
      if (result.error) return toast.error(result.error);
      toast.success(result.message);
    });
  }

  return (
    <section className="mt-5 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-900">Smart alerts</h4>
      <p className="mt-1 text-xs text-slate-500">Get an in-app alert for a meaningful price drop or when stock returns.</p>

      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800" htmlFor={`drop-${productId}`}>
            <BellRing className="h-4 w-4 text-indigo-600" /> Price drop
          </label>
          {initialPriceDrop && (
            <button type="button" disabled={isPending} onClick={() => clear("PRICE_DROP")} className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-60">
              <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            id={`drop-${productId}`}
            type="number"
            min="1"
            max="90"
            step="1"
            value={percentage}
            onChange={(event) => setPercentage(event.target.value)}
            placeholder="e.g. 10"
            disabled={isPending}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button type="button" disabled={isPending || !percentage} onClick={() => save("PRICE_DROP")} className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {initialPriceDrop ? "Update" : "Alert at %"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800"><PackageCheck className="h-4 w-4 text-indigo-600" /> Back in stock</p>
          <p className="mt-1 text-xs text-slate-500">Alert when a checked listing returns to stock.</p>
        </div>
        <button type="button" disabled={isPending} onClick={() => initialBackInStock ? clear("BACK_IN_STOCK") : save("BACK_IN_STOCK")} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-60 ${initialBackInStock ? "border border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
          {initialBackInStock ? "Turn off" : "Turn on"}
        </button>
      </div>
    </section>
  );
}
