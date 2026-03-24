'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { saveProfileAction } from '@/lib/profile/actions'

// Abbreviated IANA timezone list — common zones only
// For production, embed the full list from https://data.iana.org/time-zones/
const TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
]

type Chronotype = 'morning' | 'balanced' | 'evening'
type Objective = 'performance' | 'balance' | 'recovery' | 'consistency'

const CHRONOTYPE_OPTIONS: { value: Chronotype; label: string; subtitle: string }[] = [
  { value: 'morning', label: 'Morning', subtitle: 'Early Bird' },
  { value: 'balanced', label: 'Balanced', subtitle: 'Flexible' },
  { value: 'evening', label: 'Evening', subtitle: 'Night Owl' },
]

const OBJECTIVE_OPTIONS: { value: Objective; label: string; subtitle: string }[] = [
  { value: 'performance', label: 'Performance', subtitle: 'Push your limits' },
  { value: 'balance', label: 'Balance', subtitle: 'Steady and sustainable' },
  { value: 'recovery', label: 'Recovery', subtitle: 'Rebuild and restore' },
  { value: 'consistency', label: 'Consistency', subtitle: 'Show up every day' },
]

const PROVIDER_LABELS: Record<string, string> = {
  whoop: 'WHOOP',
  google: 'Google Calendar',
}

export function OnboardingWizard() {
  const searchParams = useSearchParams()
  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  // Start at step 4 if returning from OAuth
  const [step, setStep] = useState<1 | 2 | 3 | 4>(connectedParam ? 4 : 1)
  const [timezone, setTimezone] = useState(
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Madrid',
  )
  const [tzSearch, setTzSearch] = useState('')
  const [chronotype, setChronotype] = useState<Chronotype | null>(null)
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredTimezones = TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzSearch.toLowerCase()),
  )

  function handleSelectObjective(objective: Objective) {
    if (isPending) return
    setSelectedObjective(objective)
    setSaveError(null)

    startTransition(async () => {
      const result = await saveProfileAction({
        timezone,
        chronotype: chronotype!,
        objective,
      })
      if ('error' in result) {
        setSaveError(result.error)
        setSelectedObjective(null)
      } else {
        setStep(4)
      }
    })
  }

  return (
    <div className="w-full max-w-md">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 w-2 rounded-full transition-colors ${
              s === step ? 'bg-[var(--accent)]' : s < step ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Timezone */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            What's your timezone?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            We'll use this to time your briefings correctly.
          </p>
          <input
            type="text"
            placeholder="Search timezones..."
            value={tzSearch}
            onChange={(e) => setTzSearch(e.target.value)}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm mb-2 bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="max-h-48 overflow-y-auto border border-[var(--line)] rounded-lg bg-[var(--surface)] mb-6">
            {filteredTimezones.map((tz) => (
              <button
                key={tz}
                onClick={() => setTimezone(tz)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] transition-colors ${
                  timezone === tz ? 'font-medium text-[var(--accent-strong)]' : 'text-[var(--foreground)]'
                }`}
              >
                {tz}
              </button>
            ))}
          </div>
          <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)] mb-4">
            Selected: <strong>{timezone}</strong>
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-[var(--accent)] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2 — Chronotype */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            When do you feel sharpest?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            Choose what fits you best.
          </p>
          <div className="flex flex-col gap-3">
            {CHRONOTYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setChronotype(option.value)
                  setStep(3)
                }}
                className="text-left border border-[var(--line)] rounded-lg px-4 py-3 hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] transition-all"
              >
                <p className="font-medium text-[var(--foreground)]">{option.label}</p>
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  {option.subtitle}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Objective */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            What's your main goal?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            This shapes how your briefings are framed.
          </p>
          <div className="flex flex-col gap-3">
            {OBJECTIVE_OPTIONS.map((option) => {
              const isSelected = selectedObjective === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelectObjective(option.value)}
                  disabled={isPending}
                  className={`text-left border rounded-lg px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-[var(--line)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
                  } ${isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{option.label}</p>
                      <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                        {option.subtitle}
                      </p>
                    </div>
                    {isSelected && isPending && (
                      <div className="h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {saveError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError} — please try again.
            </p>
          )}
        </div>
      )}

      {/* Step 4 — Connect Integrations */}
      {step === 4 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            Connect your data
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            Optional — skip and connect later in Settings.
          </p>

          {errorParam === 'connect_failed' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
              Could not connect integration. Please try again.
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            {(['whoop', 'google'] as const).map((provider) => {
              const isJustConnected = connectedParam === provider
              return (
                <div
                  key={provider}
                  className={`border rounded-lg px-4 py-3 flex items-center justify-between ${
                    isJustConnected
                      ? 'border-green-300 bg-green-50'
                      : 'border-[var(--line)]'
                  }`}
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {PROVIDER_LABELS[provider]}
                    </p>
                    {isJustConnected && (
                      <p className="text-xs text-green-700">Connected successfully</p>
                    )}
                  </div>
                  {isJustConnected ? (
                    <span className="text-green-600 text-lg">&#10003;</span>
                  ) : (
                    <a
                      href={`/api/integrations/${provider}/connect?returnTo=onboarding`}
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      Connect
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          <a
            href="/dashboard"
            className="block w-full text-center bg-[var(--accent)] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to dashboard
          </a>
        </div>
      )}
    </div>
  )
}
