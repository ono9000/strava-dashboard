import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getLangFromCookies, getServerMessages } from '@/lib/i18n/server'
import {
  getSession,
  getAthlete,
  getAthleteStats,
  getAllActivities,
  getActivityKudos,
  StravaRateLimitError,
} from '@/lib/strava'
import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
  getSportBreakdown,
} from '@/lib/calculations'
import { getYearlyChallenge } from '@/lib/yearlyChallenge'
import type { SummaryAthlete } from '@/types/strava'
import ProfileCard from '@/components/ProfileCard'
import MetricsGrid from '@/components/MetricsGrid'
import BestMarks from '@/components/BestMarks'
import Achievements from '@/components/Achievements'
import FunFact from '@/components/FunFact'
import ActivityHeatmap from '@/components/ActivityHeatmap'
import MonthlyChart from '@/components/MonthlyChart'
import TopPerformances from '@/components/TopPerformances'
import SportBreakdown from '@/components/SportBreakdown'
import RunningPartners from '@/components/RunningPartners'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })

export default async function DashboardPage() {
  const lang = getLangFromCookies()
  const t = getServerMessages(lang)

  const session = getSession()
  if (!session) redirect('/')

  try {
    const [athlete, stats, activities] = await Promise.all([
      getAthlete(session.access_token),
      getAthleteStats(session.access_token, session.athlete_id),
      getAllActivities(session.access_token),
    ])

    const totals = stats.all_run_totals
    const totalKm = totals.distance / 1000

    const bestMarks = {
      best5k:       getBestForDistance(activities, 4800, 5200),
      best10k:      getBestForDistance(activities, 9800, 10300),
      bestHalf:     getBestForDistance(activities, 20900, 21500),
      bestMarathon: getBestForDistance(activities, 42000, 43000),
      longest: activities.reduce(
        (best, a) => (a.distance > (best?.distance ?? 0) ? a : best),
        null as (typeof activities)[0] | null
      ),
      bestWeek:  getBestWeek(activities, lang),
      bestMonth: getBestMonth(activities, lang),
    }

    const yearlyChallenge = getYearlyChallenge(stats.ytd_run_totals.distance / 1000)
    const funFacts  = computeFunFacts(totalKm, totals.elevation_gain)

    const metrics = {
      totalKm:        totalKm.toFixed(1),
      totalActivities: totals.count,
      totalTime:       formatTime(totals.moving_time),
      elevation:       formatElevation(totals.elevation_gain),
      avgPace:         formatPace(totals.moving_time, totals.distance),
      avgDistance:     totals.count > 0
        ? `${(totalKm / totals.count).toFixed(1)} km`
        : t.common.dash,
    }

    const primarySport = getPrimarySport(activities)
    const athleteSince = new Date(athlete.created_at).getFullYear().toString()

    // Running partners — gracefully degrades to [] if any kudos request fails
    const groupRuns = activities
      .filter((a) => a.sport_type === 'Run' && (a.athlete_count ?? 1) > 1)
      .slice(0, 10)

    let runningPartners: { athlete: SummaryAthlete; count: number }[] = []
    try {
      const kudosLists = await Promise.all(
        groupRuns.map((a) => getActivityKudos(session.access_token, a.id))
      )
      const partnerMap = new Map<number, { athlete: SummaryAthlete; count: number }>()
      for (const kudosList of kudosLists) {
        for (const a of kudosList) {
          const entry = partnerMap.get(a.id)
          if (entry) entry.count++
          else partnerMap.set(a.id, { athlete: a, count: 1 })
        }
      }
      runningPartners = Array.from(partnerMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
    } catch {
      // silently degrade — section will be hidden
    }

    const hasSports = getSportBreakdown(activities).length > 0

    return (
      <main className="min-h-screen bg-[#0f0f0f] text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
          <div className="flex justify-end">
            <a
              href="/api/auth/logout"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              {t.dashboard.logout}
            </a>
          </div>
          <ProfileCard
            athlete={athlete}
            primarySport={primarySport}
            athleteSince={athleteSince}
            yearlyChallenge={yearlyChallenge}
          />
          <MetricsGrid metrics={metrics} />
          <section>
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
              {t.dashboard.sections.activity}
            </h2>
            <ActivityHeatmap activities={activities} />
          </section>
          <section>
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
              {t.dashboard.sections.kmPerMonth}
            </h2>
            <MonthlyChart activities={activities} />
          </section>
          <BestMarks bestMarks={bestMarks} />
          <section>
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
              {t.dashboard.sections.bestPerformances}
            </h2>
            <TopPerformances activities={activities} />
          </section>
          <Achievements totals={totals} activities={activities} bestMarks={bestMarks} />
          <FunFact funFacts={funFacts} />
          {hasSports && (
            <section>
              <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                {t.dashboard.sections.otherActivities}
              </h2>
              <SportBreakdown activities={activities} />
            </section>
          )}
          {runningPartners.length > 0 && (
            <section>
              <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                {t.dashboard.sections.runningPartners}
              </h2>
              <RunningPartners partners={runningPartners} />
            </section>
          )}
          <section>
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
              {t.dashboard.sections.routes}
            </h2>
            <RouteMap activities={activities} />
          </section>
        </div>
      </main>
    )
  } catch (error) {
    if (error instanceof StravaRateLimitError) {
      return (
        <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-xl font-bold">{t.dashboard.rateLimit.title}</p>
            <p className="text-white/60">{t.dashboard.rateLimit.subtitle}</p>
            <a
              href="/dashboard"
              className="inline-block mt-4 px-6 py-2 bg-[#FC4C02] rounded-full text-sm font-semibold"
            >
              {t.common.retry}
            </a>
          </div>
        </main>
      )
    }
    throw error
  }
}
