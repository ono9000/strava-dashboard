export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="display-font text-4xl text-[var(--foreground)]">Privacy Policy</h1>
      <p className="mt-6 text-base leading-7 text-[var(--foreground)]">
        Axial Day uses connected wearable and calendar data only to generate daily planning recommendations.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6 text-sm leading-6 text-[var(--foreground)]">
        <li>We store only data required to compute daily readiness and planning suggestions.</li>
        <li>OAuth tokens are encrypted at rest.</li>
        <li>You can request deletion of your account data at any time.</li>
        <li>We do not sell personal data to third parties.</li>
      </ul>
      <p className="mt-8 text-xs text-[color-mix(in_srgb,var(--foreground)_70%,white)]">
        Contact: privacy@axialday.app
      </p>
    </main>
  );
}
