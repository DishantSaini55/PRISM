import { createClient } from "@/utils/supabase/server";
import { getDashboardData } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import PrismDashboard from "@/components/PrismDashboard";
import { TrendingDown, Shield, Bell, Rabbit } from "lucide-react";
import AuthButton from "@/components/AuthButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dashboard = user
    ? await getDashboardData()
    : { trackedProducts: [], alerts: [], alertCount: 0 };

  const FEATURES = [
    {
      icon: Rabbit,
      title: "Lightning Fast",
      description:
        "Deal Drop extracts prices in seconds, handling JavaScript and dynamic content",
    },
    {
      icon: Shield,
      title: "Always Reliable",
      description:
        "Works across all major e-commerce sites with built-in anti-bot protection",
    },
    {
      icon: Bell,
      title: "Smart Alerts",
      description: "Get notified instantly when prices drop below your target",
    },
  ];

  return (
    <main className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold tracking-tight text-slate-950">
              PRISM<span className="text-indigo-600">.</span>
            </div>
          </div>

          <AuthButton user={user} />
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-6 py-2 rounded-full text-sm font-medium mb-6">
            Made with ❤️ by Roadside Coder
          </div>

          <h2 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Know when to buy
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Compare supported stores, understand price movement, and make a
            clearer buying decision.
          </p>

          <AddProductForm user={user} />

          {/* Features */}
          {!user && (
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="bg-white p-6 rounded-xl border border-gray-200"
                >
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Icon className="w-6 h-6 text-orange-500" />
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
          alertCount={dashboard.alertCount}
        />
      )}
    </main>
  );
}
