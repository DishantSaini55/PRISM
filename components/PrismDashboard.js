import { ExternalLink, PackageSearch, Radar, Store } from "lucide-react";
import Link from "next/link";
import TargetPriceForm from "./TargetPriceForm";
import PriceHistoryPanel from "./PriceHistoryPanel";

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

export default function PrismDashboard({ trackedProducts, alerts, notifications, alertCount }) {
  const offers = trackedProducts.flatMap((item) => item.product?.product_sources || []);

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

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {trackedProducts.map((trackedProduct) => (
          <ProductInsightCard
            key={trackedProduct.id}
            trackedProduct={trackedProduct}
            targetAlert={alerts.find(
              (alert) => alert.product_id === trackedProduct.product?.id && alert.alert_type === "TARGET_REACHED"
            )}
          />
        ))}
      </div>

      {notifications.length > 0 && (
        <section className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <h2 className="text-sm font-semibold text-indigo-950">Recent price alerts</h2>
          <ul className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                Target reached: {formatPrice(notification.payload?.price, notification.payload?.currency)}
                {" "}(target {formatPrice(notification.payload?.target_price, notification.payload?.currency)}).
              </li>
            ))}
          </ul>
        </section>
      )}
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

function ProductInsightCard({ trackedProduct, targetAlert }) {
  const product = trackedProduct.product;
  const sources = [...(product?.product_sources || [])].sort(sourceSort);
  const lowestOffer = sources.find((source) => source.current_price !== null);
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
            Best current offer: {lowestOffer ? formatPrice(lowestOffer.current_price, lowestOffer.currency) : "not available"}
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-900">Store comparison</h4>
          <RecommendationBadge recommendation={latestRecommendation} />
        </div>

        {sources.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{source.store?.name || "Store listing"}</p>
                  <p className="text-xs text-slate-500">{source.availability.replaceAll("_", " ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-950">{formatPrice(source.current_price, source.currency)}</span>
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

        <TargetPriceForm
          productId={product.id}
          initialTargetPrice={targetAlert?.target_price ?? null}
        />
        <PriceHistoryPanel productId={product.id} />
      </div>
    </article>
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
    </span>
  );
}
