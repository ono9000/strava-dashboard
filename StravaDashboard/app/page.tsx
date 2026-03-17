export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-[#FC4C02] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#FC4C02]/20">
            <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Strava Dashboard</h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Toda tu historia deportiva de un vistazo.
            <br />
            Tus mejores marcas, tus logros, tu reto.
          </p>
        </div>

        <a
          href="/api/auth/strava"
          className="flex items-center justify-center gap-3 w-full py-4 bg-[#FC4C02] hover:bg-[#E63D00] rounded-2xl font-semibold text-white text-lg transition-colors duration-200 shadow-lg shadow-[#FC4C02]/20"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Conectar con Strava
        </a>

        <p className="text-white/30 text-xs">
          Solo lectura. Nunca publicamos en tu cuenta.
        </p>
      </div>
    </main>
  )
}
