'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xl font-bold">Algo salió mal.</p>
        <button
          onClick={reset}
          className="mt-4 px-6 py-2 bg-[#FC4C02] rounded-full text-sm font-semibold"
        >
          Reintentar
        </button>
        <div className="mt-2">
          <a href="/" className="text-white/40 text-sm hover:text-white/70">
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  )
}
