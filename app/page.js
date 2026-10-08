import { createClient } from "@/utils/supabase/server";
import { getDashboardData } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import PrismDashboard from "@/components/PrismDashboard";
import { BadgeIndianRupee, BellRing, ScanSearch } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Image from "next/image";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dashboard = user
    ? await getDashboardData()
    : {
        trackedProducts: [],
        alerts: [],
        notifications: [],
        alertCount: 0,
        unreadNotificationCount: 0
      };

  const FEATURES = [
    {
      icon: ScanSearch,
      title: "Exact variant matching",
      description:
        "Storage, RAM, color and model are checked before offers are compared.",
    },
    {
      icon: BadgeIndianRupee,
      title: "Best price, clearly shown",
      description:
        "Compare verified store offers and see the potential saving immediately.",
    },
    {
      icon: BellRing,
      title: "Price intelligence",
      description: "Get notified instantly when prices drop below your target",
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff_0,_#fafaff_38%,_#ffffff_72%)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-indigo-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image src="/brand/prism-logo-v2.png" alt="PRISM" width={42} height={42} className="h-10 w-10" priority />
            <div>
              <div className="text-xl font-black tracking-[-0.05em] text-slate-950">PRISM</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600">Price intelligence</div>
            </div>
          </div>

          <AuthButton user={user} />
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 pb-14 pt-16 sm:pt-20">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 shadow-sm">
            VERIFIED MULTI-STORE PRICE COMPARISON
          </div>

          <h2 className="mx-auto max-w-4xl text-5xl font-black tracking-[-0.055em] text-slate-950 sm:text-6xl">
            Find the right product.<br /><span className="text-indigo-600">Pay the right price.</span>
          </h2>
          <p className="mx-auto mb-10 mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Paste a product URL to verify its exact variant, compare supported stores, and track the best time to buy.
          </p>

          <AddProductForm user={user} />

          {/* Features */}
          {!user && (
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                className="rounded-2xl border border-indigo-100 bg-white/85 p-6 shadow-sm"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                    <Icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {user && (
        <PrismDashboard
          trackedProducts={dashboard.trackedProducts}
          alerts={dashboard.alerts}
          notifications={dashboard.notifications}
          alertCount={dashboard.alertCount}
          unreadNotificationCount={dashboard.unreadNotificationCount}
        />
      )}
    </main>
  );
}
