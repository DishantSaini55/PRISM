import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AccountPreferencesForm from "@/components/AccountPreferencesForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("users").select("email, display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("timezone, email_alerts_enabled, browser_push_enabled").eq("user_id", user.id).maybeSingle()
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Account settings</h1>
        <p className="mt-2 text-sm text-slate-600">Signed in as {profile?.email || user.email}</p>
        <AccountPreferencesForm profile={profile} preferences={preferences} />
      </div>
    </main>
  );
}
