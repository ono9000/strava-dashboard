import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware should have caught this, but defend anyway
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { connected } = await searchParams;

  // Profile exists and this is NOT an OAuth return → go to dashboard
  if (profile && !connected) {
    redirect("/dashboard");
  }

  // Profile exists and ?connected= is present → user returned from OAuth on step 4
  // The wizard reads ?connected= and ?error= directly from useSearchParams()

  return <OnboardingWizard />;
}
