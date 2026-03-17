function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#1a1a1a] border border-white/10 rounded-2xl animate-pulse ${className}`} />
  )
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {/* Profile */}
        <SkeletonCard className="h-28" />
        {/* Metrics 2×3 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)}
        </div>
        {/* Best marks — 7 cards (5K, 10K, Half, Marathon, Longest, Best Week, Best Month) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} className="h-20" />)}
        </div>
        {/* Challenge bar */}
        <SkeletonCard className="h-36" />
        {/* Achievements */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} className="h-20" />)}
        </div>
        {/* Fun fact */}
        <SkeletonCard className="h-28" />
      </div>
    </main>
  )
}
