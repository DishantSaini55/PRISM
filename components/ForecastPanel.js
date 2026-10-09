"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { getProductForecast } from "@/app/actions";

function formatPrice(value, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2
  }).format(Number(value));
}

export default function ForecastPanel({ productId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function toggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || result || isLoading) return;

    setIsLoading(true);
    setError(null);
    const nextResult = await getProductForecast(productId);
    if (nextResult.error) setError(nextResult.error);
    else setResult(nextResult);
    setIsLoading(false);
  }

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <button type="button" onClick={toggle} className="flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
        <Sparkles className="h-4 w-4" />
        {isOpen ? "Hide price outlook" : "Show price outlook"}
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
          {isLoading && <p className="flex items-center gap-2 text-sm text-indigo-800"><Loader2 className="h-4 w-4 animate-spin" /> Calculating from recorded prices…</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {!isLoading && !error && result?.historyCount < 7 && (
            <p className="text-sm leading-6 text-slate-700">Forecasts need at least 7 same-currency observations. PRISM has {result?.historyCount || 0} so far; keep tracking to build useful evidence.</p>
          )}
          {!isLoading && !error && result?.forecasts?.length > 0 && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.forecasts.map((forecast) => (
                  <div key={forecast.horizonDays} className="rounded-md bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Estimated in {forecast.horizonDays} days</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{formatPrice(forecast.predictedPrice, result.currency)}</p>
                    <p className="mt-1 text-xs text-slate-600">Fit confidence: {Math.round(forecast.confidence)}%</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">Based on {result.historyCount} recorded {result.currency} prices. This is a transparent trend estimate, not a guarantee or buying advice.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
