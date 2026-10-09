"use client";

import { ExternalLink, PackageSearch, Radar, Search, Store } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import TargetPriceForm from "./TargetPriceForm";
import PriceHistoryPanel from "./PriceHistoryPanel";
import CompareStoresButton from "./CompareStoresButton";
import ReviewStoreMatch from "./ReviewStoreMatch";
import SmartAlertsForm from "./SmartAlertsForm";
import NotificationCenter from "./NotificationCenter";
import UntrackProductButton from "./UntrackProductButton";
import RefreshPricesButton from "./RefreshPricesButton";
import ShareProductButton from "./ShareProductButton";
import ScrapeHealthPanel from "./ScrapeHealthPanel";

function isVerifiedSource(source) {
  // PENDING exists for direct listings created before explicit match statuses
  // were written. Those listings came from a user-provided product page.
  return source.match_status === "MATCHED" || source.match_status === "PENDING";
}

function formatPrice(price, currency) {
  if (price === null || price === undefined) return "Price unavailable";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2
    }).format(Number(price));
  } catch {
    return `${currency || ""} ${price}`.trim();
  }
}

function sourceSort(left, right) {
  if (left.current_price === null) return 1;
  if (right.current_price === null) return -1;
  return Number(left.current_price) - Number(right.current_price);
}

function timeAgo(value) {
  if (!value) return "Not checked yet";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Checked just now";
  if (minutes < 60) return `Checked ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Checked ${hours} hr ago` : `Checked ${Math.round(hours / 24)} days ago`;
}

export default function PrismDashboard({ trackedProducts, alerts, notifications, alertCount, unreadNotificationCount, scrapeJobs }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const offers = trackedProducts.flatMap((item) =>
    (item.product?.product_sources || []).filter(isVerifiedSource)
  );
  const visibleTrackedProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...trackedProducts]
      .filter((item) => {
        const product = item.product || {};
        return !normalizedQuery || [product.name, product.brand, product.model, product.category]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sortBy === "name") return (left.product?.name || "").localeCompare(right.product?.name || "");
        if (sortBy === "best-price") {
          const bestPrice = (item) => Math.min(...(item.product?.product_sources || []).filter(isVerifiedSource).map((source) => Number(source.current_price)).filter(Number.isFinite), Infinity);
          return bestPrice(left) - bestPrice(right);
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [query, sortBy, trackedProducts]);

  if (trackedProducts.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <PackageSearch className="mx-auto h-12 w-12 text-indigo-500" />
          <h2 className="mt-4 text-xl font-semibold text-slate-950">Your price intelligence dashboard is ready</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Search for a product or paste a supported store URL above. Once tracked,
            its offers, price history, alerts, and recommendation will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Tracked products" value={trackedProducts.length} icon={Radar} />
        <Metric label="Store offers" value={offers.length} icon={Store} />
        <Metric label="Active alerts" value={alertCount} icon={PackageSearch} />
      </div>

      <div className="mt-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">YOUR PRODUCTS</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Track the right moment to buy</h2>
        </div>
        <span className="text-sm text-slate-500">Prices are shown per store</span>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search tracked products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your tracked products" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-indigo-200 focus:ring-2" /></label>
        <label className="text-sm text-slate-600"><span className="sr-only">Sort products</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-medium text-slate-700 outline-none ring-indigo-200 focus:ring-2"><option value="recent">Recently tracked</option><option value="best-price">Lowest best price</option><option value="name">Name A–Z</option></select></label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {visibleTrackedProducts.map((trackedProduct) => (
          <ProductInsightCard
            key={trackedProduct.id}
            trackedProduct={trackedProduct}
            alerts={alerts}
            targetAlert={alerts.find(
              (alert) => alert.product_id === trackedProduct.product?.id && alert.alert_type === "TARGET_REACHED"
            )}
          />
        ))}
      </div>
      {visibleTrackedProducts.length === 0 && <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No tracked products match that search.</p>}

      <NotificationCenter notifications={notifications} unreadCount={unreadNotificationCount} />
      <ScrapeHealthPanel jobs={scrapeJobs || []} />
    </section>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-indigo-600" />
      <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function ProductInsightCard({ trackedProduct, targetAlert, alerts }) {
  const product = trackedProduct.product;
  const sources = [...(product?.product_sources || [])]
    .filter(isVerifiedSource)
    .sort(sourceSort);
  const reviewSources = (product?.product_sources || []).filter(
    (source) => source.match_status === "NEEDS_REVIEW"
  );
  const purchasableOffers = sources.filter(
    (source) => source.current_price !== null && source.availability !== "OUT_OF_STOCK" && source.availability !== "DISCONTINUED"
  );
  const lowestOffer = purchasableOffers[0];
  const comparableOffers = purchasableOffers.filter(
    (source) => source.currency === lowestOffer?.currency
  );
  const highestOffer = comparableOffers.at(-1);
  const savings = lowestOffer && highestOffer
    ? Number(highestOffer.current_price) - Number(lowestOffer.current_price)
    : 0;
  const latestRecommendation = [...(product?.recommendations || [])].sort(
    (left, right) => new Date(right.created_at) - new Date(left.created_at)
  )[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-4 border-b border-slate-100 p-5">
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-20 w-20 rounded-lg border border-slate-100 object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <PackageSearch className="h-8 w-8" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{product?.brand || product?.category || "Tracked product"}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-950">{product?.name}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {lowestOffer
              ? `Best price: ${lowestOffer.store?.name || "Store"} — ${formatPrice(lowestOffer.current_price, lowestOffer.currency)}`
              : "No purchasable offer available"}
          </p>
          <Link href={`/products/${product.id}`} className="mt-2 inline-block text-xs font-semibold text-indigo-700 hover:text-indigo-900">
            View product details
          </Link>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <ShareProductButton productId={product.id} />
          <UntrackProductButton productId={product.id} />
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-900">Store comparison</h4>
          <div className="flex items-center gap-2">
            <RefreshPricesButton productId={product.id} />
            <CompareStoresButton productId={product.id} />
            <RecommendationBadge recommendation={latestRecommendation} />
          </div>
        </div>

        {sources.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{source.store?.name || "Store listing"}</p>
                  <p className="text-xs text-slate-500">
                    {source.availability.replaceAll("_", " ")} · {timeAgo(source.last_checked_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-950">{formatPrice(source.current_price, source.currency)}</span>
                  {source.id === lowestOffer?.id && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">BEST</span>
                  )}
                  <Link href={source.url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600" aria-label={`Open ${source.store?.name || "store"} listing`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No store offers have been collected yet.</p>
        )}

        {savings > 0 && lowestOffer && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            You can save {formatPrice(savings, lowestOffer.currency)} by buying from {lowestOffer.store?.name}.
          </p>
        )}

        {reviewSources.length > 0 && (
          <section className="mt-5 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-900">Possible store matches</h4>
            <p className="mt-1 text-xs text-slate-500">They are excluded from prices until you verify them.</p>
            <div className="mt-3 space-y-3">
              {reviewSources.map((source) => (
                <ReviewStoreMatch key={source.id} productId={product.id} source={source} />
              ))}
            </div>
          </section>
        )}

        <RecommendationSummary recommendation={latestRecommendation} />
        <TargetPriceForm
          productId={product.id}
          initialTargetPrice={targetAlert?.target_price ?? null}
        />
        <SmartAlertsForm
          productId={product.id}
          initialPriceDrop={alerts.find((alert) => alert.product_id === product.id && alert.alert_type === "PRICE_DROP")}
          initialBackInStock={alerts.find((alert) => alert.product_id === product.id && alert.alert_type === "BACK_IN_STOCK")}
          initialAllTimeLow={alerts.find((alert) => alert.product_id === product.id && alert.alert_type === "ALL_TIME_LOW")}
        />
        <PriceHistoryPanel productId={product.id} />
      </div>
    </article>
  );
}

function RecommendationSummary({ recommendation }) {
  if (!recommendation) return null;

  const details =
    recommendation.reasoning && typeof recommendation.reasoning === "object"
      ? recommendation.reasoning
      : {};
  const reasons = Array.isArray(details.reasoning) ? details.reasoning : [];
  const observationCount = Number(details.observationCount);
  const evidence = Number(recommendation.confidence);

  return (
    <section className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
      <p className="text-sm font-semibold text-indigo-950">
        {details.title || "Recommendation"}: {Math.round(Number(recommendation.buy_score))}/100
      </p>
      {Number.isFinite(observationCount) && (
        <p className="mt-1 text-xs text-indigo-800">
          Evidence: {observationCount} price {observationCount === 1 ? "observation" : "observations"}
          {Number.isFinite(evidence) && ` (${Math.round(evidence)}% data coverage)`}.
        </p>
      )}
      {reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
          {reasons.slice(0, 2).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      )}
      {details.thresholdNote && (
        <p className="mt-2 text-xs leading-4 text-slate-500">{details.thresholdNote}</p>
      )}
    </section>
  );
}

function RecommendationBadge({ recommendation }) {
  if (!recommendation) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Collecting data</span>;
  }

  const styles = {
    BUY_NOW: "bg-emerald-100 text-emerald-800",
    MONITOR: "bg-amber-100 text-amber-800",
    WAIT: "bg-rose-100 text-rose-800"
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[recommendation.recommendation] || "bg-slate-100 text-slate-700"}`}>
      {recommendation.recommendation?.replaceAll("_", " ") || "RECOMMENDATION"}
      {typeof recommendation.buy_score === "number" && ` · ${Math.round(recommendation.buy_score)}`}
    </span>
  );
}
