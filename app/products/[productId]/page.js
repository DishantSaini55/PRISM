import Link from "next/link";
import { ArrowLeft, ExternalLink, PackageSearch } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CompareStoresButton from "@/components/CompareStoresButton";
import PriceHistoryPanel from "@/components/PriceHistoryPanel";
import RefreshPricesButton from "@/components/RefreshPricesButton";
import ShareProductButton from "@/components/ShareProductButton";
import SmartAlertsForm from "@/components/SmartAlertsForm";
import TargetPriceForm from "@/components/TargetPriceForm";
import ForecastPanel from "@/components/ForecastPanel";
import ProductNotes from "@/components/ProductNotes";
import ShareAnalytics from "@/components/ShareAnalytics";

function formatPrice(price, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2
  }).format(Number(price));
}

export default async function ProductDetailPage({ params }) {
  const { productId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: tracked, error: trackedError }, { data: alerts, error: alertsError }, { data: note, error: noteError }] = await Promise.all([
    supabase
      .from("tracked_products")
      .select("id, created_at, product:products(id, name, brand, model, category, description, image_url, normalized_attributes, product_sources(id, url, current_price, currency, availability, last_checked_at, match_status, store:stores(name, domain)), recommendations(buy_score, recommendation, created_at))")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("price_alerts")
      .select("id, product_id, alert_type, target_price, percentage_drop")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("is_active", true),
    supabase
      .from("product_notes")
      .select("note, tags")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle()
  ]);

  if (trackedError || alertsError || noteError) throw trackedError || alertsError || noteError;
  if (!tracked?.product) notFound();

  const product = tracked.product;
  const productAlerts = alerts || [];
  const offers = (product.product_sources || [])
    .filter((source) => source.match_status === "MATCHED" || source.match_status === "PENDING")
    .sort((left, right) => Number(left.current_price ?? Infinity) - Number(right.current_price ?? Infinity));
  const attributes = product.normalized_attributes || {};

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <article className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex gap-5 border-b border-slate-100 p-6">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt="" className="h-24 w-24 rounded-xl border border-slate-100 object-cover" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><PackageSearch className="h-10 w-10" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-indigo-600">{product.brand || product.category || "Tracked product"}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{product.name}</h1>
              {product.description && <p className="mt-2 text-sm leading-6 text-slate-600">{product.description}</p>}
            </div>
            <ShareProductButton productId={product.id} />
          </header>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-950">Verified store offers</h2>
                <div className="flex gap-2"><RefreshPricesButton productId={product.id} /><CompareStoresButton productId={product.id} /></div>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                {offers.map((source) => (
                  <li key={source.id} className="flex items-center justify-between gap-3 py-4">
                    <div><p className="font-medium text-slate-900">{source.store?.name || "Store"}</p><p className="mt-1 text-xs text-slate-500">{source.availability.replaceAll("_", " ")}</p></div>
                    <div className="flex items-center gap-2"><strong className="text-slate-950">{formatPrice(source.current_price, source.currency)}</strong><Link href={source.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600"><ExternalLink className="h-4 w-4" /></Link></div>
                  </li>
                ))}
                {offers.length === 0 && <li className="py-4 text-sm text-slate-500">No verified offers yet.</li>}
              </ul>
              <PriceHistoryPanel productId={product.id} />
              <ForecastPanel productId={product.id} />
            </section>

            <aside className="rounded-xl bg-slate-50 p-4">
              <h2 className="text-base font-semibold text-slate-950">Variant details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {Object.entries(attributes).filter(([, value]) => value && typeof value !== "object").map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="capitalize text-slate-500">{key}</dt><dd className="text-right font-medium text-slate-800">{String(value)}</dd></div>)}
              </dl>
              <TargetPriceForm productId={product.id} initialTargetPrice={productAlerts.find((alert) => alert.alert_type === "TARGET_REACHED")?.target_price ?? null} />
              <SmartAlertsForm
                productId={product.id}
                initialPriceDrop={productAlerts.find((alert) => alert.alert_type === "PRICE_DROP")}
                initialBackInStock={productAlerts.find((alert) => alert.alert_type === "BACK_IN_STOCK")}
                initialAllTimeLow={productAlerts.find((alert) => alert.alert_type === "ALL_TIME_LOW")}
              />
              <ProductNotes productId={product.id} initialNote={note?.note} initialTags={note?.tags} />
              <ShareAnalytics productId={product.id} />
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
