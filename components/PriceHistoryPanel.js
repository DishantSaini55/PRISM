"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { getProductPriceHistory } from "@/app/actions";

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2
  }).format(value);
}

export default function PriceHistoryPanel({ productId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  async function toggleHistory() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (!nextOpen || history !== null || isLoading) return;

    setIsLoading(true);
    setError(null);
    const result = await getProductPriceHistory(productId);

    if (result.error) {
      setError(result.error);
    } else {
      setHistory(result.history || []);
    }

    setIsLoading(false);
  }

  const currency = history?.[0]?.currency || "INR";
  const chartData = (history || [])
    .filter((item) => item.currency === currency)
    .map((item) => ({
      date: new Date(item.checked_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      }),
      price: Number(item.price)
    }));
  const prices = chartData.map((item) => item.price);
  const lowest = prices.length ? Math.min(...prices) : null;
  const highest = prices.length ? Math.max(...prices) : null;
  const average = prices.length
    ? prices.reduce((sum, price) => sum + price, 0) / prices.length
    : null;

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={toggleHistory}
        className="flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
      >
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {isOpen ? "Hide price history" : "Show price history"}
      </button>

      {isOpen && (
        <div className="mt-4">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading price history...
            </p>
          )}

          {error && <p className="text-sm text-rose-700">{error}</p>}

          {!isLoading && !error && history?.length === 0 && (
            <p className="text-sm text-slate-500">No price observations have been collected yet.</p>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Lowest" value={formatCurrency(lowest, currency)} />
                <Stat label="Average" value={formatCurrency(average, currency)} />
                <Stat label="Highest" value={formatCurrency(highest, currency)} />
              </div>
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis
                      width={66}
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      tickFormatter={(value) => `₹${Math.round(value)}`}
                    />
                    <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#4f46e5" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {history.length !== chartData.length && (
                <p className="mt-2 text-xs text-slate-500">
                  The chart shows {currency} observations only; currencies are never combined.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
