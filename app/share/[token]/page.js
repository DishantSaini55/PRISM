import Link from "next/link";
import { ExternalLink, PackageSearch } from "lucide-react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";

function formatPrice(price, currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(price));
}

export default async function SharedProductPage({ params }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) notFound();

  const admin = createAdminClient();
  const { data: share, error } = await admin
    .from("product_shares")
    .select("product_id, expires_at, revoked_at, product:products(id, name, brand, image_url)")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!share || (share.expires_at && new Date(share.expires_at) <= new Date())) notFound();

  const { data: sources, error: sourcesError } = await admin
    .from("product_sources")
    .select("id, url, current_price, currency, availability, match_status, store:stores(name)")
    .eq("product_id", share.product_id)
    .in("match_status", ["MATCHED", "PENDING"])
    .order("current_price", { ascending: true });
  if (sourcesError) throw sourcesError;

  const product = share.product;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex gap-4 border-b border-slate-100 p-6">
          {product?.image_url ? <img src={product.image_url} alt="" className="h-20 w-20 rounded-xl border border-slate-100 object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><PackageSearch className="h-8 w-8" /></div>}
          <div><p className="text-sm font-medium text-indigo-600">PRISM shared comparison</p><h1 className="mt-1 text-xl font-bold text-slate-950">{product?.name}</h1><p className="mt-1 text-sm text-slate-500">Read-only current offers</p></div>
        </header>
        <ul className="divide-y divide-slate-100 px-6">
          {(sources || []).map((source) => <li key={source.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-medium text-slate-900">{source.store?.name || "Store"}</p><p className="mt-1 text-xs text-slate-500">{source.availability.replaceAll("_", " ")}</p></div><div className="flex items-center gap-2"><strong>{formatPrice(source.current_price, source.currency)}</strong><Link href={source.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600"><ExternalLink className="h-4 w-4" /></Link></div></li>)}
          {sources?.length === 0 && <li className="py-5 text-sm text-slate-500">No verified offers are available yet.</li>}
        </ul>
        <footer className="border-t border-slate-100 p-5 text-center text-xs text-slate-500">Shared with PRISM Price Intelligence</footer>
      </section>
    </main>
  );
}
