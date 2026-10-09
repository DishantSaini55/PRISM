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
import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";
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
  const [range, setRange] = useState("all");

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
  const rangeDays = range === "all" ? null : Number(range);
  const rangeStart = rangeDays
    ? Date.now() - rangeDays * 24 * 60 * 60 * 1000
    : null;
  const sameCurrencyHistory = (history || []).filter((item) => item.currency === currency);
  const filteredHistory = sameCurrencyHistory.filter(
    (item) => !rangeStart || new Date(item.checked_at).getTime() >= rangeStart
  );
  const chartData = filteredHistory
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
  const firstPrice = prices[0] ?? null;
  const latestPrice = prices.at(-1) ?? null;
  const trendAmount = firstPrice !== null && latestPrice !== null ? latestPrice - firstPrice : null;
  const trendPercent = trendAmount !== null && firstPrice > 0 ? (trendAmount / firstPrice) * 100 : null;
  const trendLabel = trendAmount === null || Math.abs(trendAmount) < 0.01
    ? "Stable in this period"
    : trendAmount < 0
      ? "Trending down"
      : "Trending up";

  function exportCsv() {
    if (!history?.length) return;

    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Checked at", "Price", "Currency", "Availability", "Product source ID"],
      ...history.map((point) => [
        point.checked_at,
        point.price,
        point.currency,
        point.availability,
        point.product_source_id
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `prism-price-history-${productId}.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

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

          {!isLoading && !error && history?.length > 0 && chartData.length === 0 && (
            <div className="rounded-md bg-slate-50 p-3">
              <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
                No {currency} observations fall within this time range.
                <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All history</option>
                </select>
              </label>
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <Stat label="Lowest" value={formatCurrency(lowest, currency)} />
                  <Stat label="Average" value={formatCurrency(average, currency)} />
                  <Stat label="Highest" value={formatCurrency(highest, currency)} />
                </div>
                <button type="button" onClick={exportCsv} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${trendAmount !== null && trendAmount < 0 ? "text-emerald-700" : trendAmount !== null && trendAmount > 0 ? "text-rose-700" : "text-slate-600"}`}>
                  {trendLabel}
                  {trendPercent !== null && Math.abs(trendPercent) >= 0.01 && ` · ${Math.abs(trendPercent).toFixed(1)}%`}
                </p>
                <label className="text-xs text-slate-600">
                  <span className="sr-only">History range</span>
                  <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All history</option>
                  </select>
                </label>
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
              {sameCurrencyHistory.length !== history.length && (
                <p className="mt-2 text-xs text-slate-500">
                  The chart shows {currency} observations only; currencies are never combined.
                </p>
              )}
              {filteredHistory.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">No {currency} observations fall within this time range.</p>
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
