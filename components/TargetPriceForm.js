"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { clearTargetPriceAlert, saveTargetPriceAlert } from "@/app/actions";

export default function TargetPriceForm({ productId, initialTargetPrice }) {
  const [targetPrice, setTargetPrice] = useState(
    initialTargetPrice ? String(initialTargetPrice) : ""
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("targetPrice", targetPrice);

    startTransition(async () => {
      const result = await saveTargetPriceAlert(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
    });
  }

  function clearAlert() {
    startTransition(async () => {
      const result = await clearTargetPriceAlert(productId);
      if (result.error) return toast.error(result.error);
      setTargetPrice("");
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-slate-900" htmlFor={`target-${productId}`}>
          Target price alert
        </label>
        {initialTargetPrice && <button type="button" onClick={clearAlert} disabled={isPending} className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-60">Remove</button>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Save a target in INR. You can update it whenever you want.
      </p>
      <div className="mt-3 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-md border border-slate-200 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <span className="text-sm text-slate-500">₹</span>
          <input
            id={`target-${productId}`}
            type="number"
            min="0.01"
            step="0.01"
            required
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            disabled={isPending}
            placeholder="e.g. 14000"
            className="w-full bg-transparent px-2 py-2 text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : initialTargetPrice ? "Update" : "Set alert"}
        </button>
      </div>
    </form>
  );
}
