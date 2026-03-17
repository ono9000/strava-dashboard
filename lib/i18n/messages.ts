import type { Language } from './types'

export type Messages = {
  meta: {
    title: string
    description: string
  }
  common: {
    errorTitle: string
    backHome: string
    retry: string
    noData: string
    dash: string
  }
  landing: {
    taglineLine1: string
    taglineLine2: string
    connect: string
    readOnly: string
  }
  dashboard: {
    logout: string
    sections: {
      activity: string
      kmPerMonth: string
      bestPerformances: string
      otherActivities: string
      runningPartners: string
      routes: string
    }
    rateLimit: {
      title: string
      subtitle: string
    }
  }
  profile: {
    athleteSince: (year: string) => string
    yearlyComplete: string
    yearlyProgress: (pct: number, nextKm: number) => string
    yearlyProgressHover: (ytdKm: number, nextKm: number) => string
  }
  metrics: {
    title: string
    labels: {
      totalKm: string
      activities: string
      totalTime: string
      elevation: string
      avgPace: string
      avgDistance: string
    }
  }
  bestMarks: {
    title: string
    labels: {
      half: string
      marathon: string
      longest: string
      bestWeek: string
      bestMonth: string
    }
  }
  achievements: {
    title: string
    remainingKm: (km: number) => string
    badges: {
      first100: string
      first500: string
      first1000: string
      first5000: string
      firstHalf: string
      firstMarathon: string
      recordWeek: string
      recordMonth: string
    }
  }
  funFact: {
    title: string
    facts: {
      caminoText: string
      caminoHighlight: (laps: number) => string
      teideText: string
      teideHighlight: (laps: number) => string
      marathonsText: string
      marathonsHighlight: (laps: number) => string
      retiroText: string
      retiroHighlight: (laps: number) => string
    }
  }
  heatmap: {
    ariaLabel: string
    dayLetters: string[]
    tooltip: {
      withKm: (km: number, dateLabel: string) => string
      noActivity: (dateLabel: string) => string
    }
  }
  routes: {
    noneAvailable: string
    zones: string
    loadingLocations: string
    noLocationData: string
    unknown: string
  }
  partners: {
    together: (count: number) => string
  }
  sport: {
    times: (count: number) => string
  }
  topPerformances: {
    longestRun: string
    bestPace: string
    mostElevation: string
  }
}

const messagesEs: Messages = {
  meta: {
    title: 'Strava Dashboard',
    description: 'Tu historial deportivo de un vistazo',
  },
  common: {
    errorTitle: 'Algo salió mal.',
    backHome: 'Volver al inicio',
    retry: 'Reintentar',
    noData: 'Sin datos',
    dash: '—',
  },
  landing: {
    taglineLine1: 'Toda tu historia deportiva de un vistazo.',
    taglineLine2: 'Tus mejores marcas, tus logros, tu reto.',
    connect: 'Conectar con Strava',
    readOnly: 'Solo lectura. Nunca publicamos en tu cuenta.',
  },
  dashboard: {
    logout: 'Cerrar sesión',
    sections: {
      activity: 'Actividad',
      kmPerMonth: 'Kilómetros por mes',
      bestPerformances: 'Mejores actuaciones',
      otherActivities: 'Otras actividades',
      runningPartners: 'Compañeros de carrera',
      routes: 'Tus Rutas',
    },
    rateLimit: {
      title: 'Strava está ocupado.',
      subtitle: 'Intenta de nuevo en unos minutos.',
    },
  },
  profile: {
    athleteSince: (year) => `Atleta desde ${year}`,
    yearlyComplete: '🏆 ¡Año completo!',
    yearlyProgress: (pct, nextKm) => `${pct}% → ${nextKm} km`,
    yearlyProgressHover: (ytdKm, nextKm) => `${Math.round(ytdKm)} km / ${nextKm} km`,
  },
  metrics: {
    title: 'Métricas de Running',
    labels: {
      totalKm: 'Kilómetros totales',
      activities: 'Actividades',
      totalTime: 'Tiempo entrenado',
      elevation: 'Desnivel acumulado',
      avgPace: 'Ritmo medio',
      avgDistance: 'Distancia media',
    },
  },
  bestMarks: {
    title: 'Mejores Marcas',
    labels: {
      half: 'Media Maratón',
      marathon: 'Maratón',
      longest: 'Actividad más larga',
      bestWeek: 'Semana récord',
      bestMonth: 'Mes récord',
    },
  },
  achievements: {
    title: 'Logros',
    remainingKm: (km) => `faltan ${km} km`,
    badges: {
      first100: 'Primeros 100 km',
      first500: 'Primeros 500 km',
      first1000: 'Primer 1.000 km',
      first5000: 'Primeros 5.000 km',
      firstHalf: 'Primera media maratón',
      firstMarathon: 'Primer maratón',
      recordWeek: 'Semana récord',
      recordMonth: 'Mes récord',
    },
  },
  funFact: {
    title: 'Dato Curioso',
    facts: {
      caminoText: 'Has recorrido el equivalente a',
      caminoHighlight: (laps) => `${laps} veces el Camino de Santiago`,
      teideText: 'Has subido el equivalente a',
      teideHighlight: (laps) => `${laps} veces el Teide`,
      marathonsText: 'Has completado el equivalente a',
      marathonsHighlight: (laps) => `${laps} maratones`,
      retiroText: 'Has dado',
      retiroHighlight: (laps) => `${laps} vueltas al Parque del Retiro`,
    },
  },
  heatmap: {
    ariaLabel: 'Actividad de las últimas 52 semanas',
    dayLetters: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    tooltip: {
      withKm: (km, dateLabel) => `${km.toFixed(1)} km — ${dateLabel}`,
      noActivity: (dateLabel) => `Sin actividad — ${dateLabel}`,
    },
  },
  routes: {
    noneAvailable: 'No hay rutas disponibles',
    zones: 'Zonas',
    loadingLocations: 'Cargando ubicaciones…',
    noLocationData: 'Sin datos de ubicación',
    unknown: 'Desconocido',
  },
  partners: {
    together: (count) => `${count} carrera${count === 1 ? '' : 's'} juntos`,
  },
  sport: {
    times: (count) => `${count} ${count === 1 ? 'vez' : 'veces'}`,
  },
  topPerformances: {
    longestRun: 'Carrera más larga',
    bestPace: 'Mejor ritmo',
    mostElevation: 'Más desnivel',
  },
}

const messagesEn: Messages = {
  meta: {
    title: 'Strava Dashboard',
    description: 'Your training history at a glance',
  },
  common: {
    errorTitle: 'Something went wrong.',
    backHome: 'Back to home',
    retry: 'Try again',
    noData: 'No data',
    dash: '—',
  },
  landing: {
    taglineLine1: 'Your entire training story at a glance.',
    taglineLine2: 'Your PRs, your achievements, your challenge.',
    connect: 'Connect with Strava',
    readOnly: 'Read-only. We never publish to your account.',
  },
  dashboard: {
    logout: 'Log out',
    sections: {
      activity: 'Activity',
      kmPerMonth: 'Kilometers per month',
      bestPerformances: 'Top performances',
      otherActivities: 'Other activities',
      runningPartners: 'Running partners',
      routes: 'Your routes',
    },
    rateLimit: {
      title: 'Strava is busy.',
      subtitle: 'Try again in a few minutes.',
    },
  },
  profile: {
    athleteSince: (year) => `Athlete since ${year}`,
    yearlyComplete: '🏆 Full year!',
    yearlyProgress: (pct, nextKm) => `${pct}% → ${nextKm} km`,
    yearlyProgressHover: (ytdKm, nextKm) => `${Math.round(ytdKm)} km / ${nextKm} km`,
  },
  metrics: {
    title: 'Running metrics',
    labels: {
      totalKm: 'Total distance',
      activities: 'Activities',
      totalTime: 'Training time',
      elevation: 'Elevation gain',
      avgPace: 'Average pace',
      avgDistance: 'Average distance',
    },
  },
  bestMarks: {
    title: 'Best marks',
    labels: {
      half: 'Half marathon',
      marathon: 'Marathon',
      longest: 'Longest activity',
      bestWeek: 'Best week',
      bestMonth: 'Best month',
    },
  },
  achievements: {
    title: 'Achievements',
    remainingKm: (km) => `${km} km to go`,
    badges: {
      first100: 'First 100 km',
      first500: 'First 500 km',
      first1000: 'First 1,000 km',
      first5000: 'First 5,000 km',
      firstHalf: 'First half marathon',
      firstMarathon: 'First marathon',
      recordWeek: 'Record week',
      recordMonth: 'Record month',
    },
  },
  funFact: {
    title: 'Fun fact',
    facts: {
      caminoText: "You've covered the equivalent of",
      caminoHighlight: (laps) => `${laps} Camino de Santiago trips`,
      teideText: "You've climbed the equivalent of",
      teideHighlight: (laps) => `${laps} Mount Teide ascents`,
      marathonsText: "You've completed the equivalent of",
      marathonsHighlight: (laps) => `${laps} marathons`,
      retiroText: "You've done",
      retiroHighlight: (laps) => `${laps} laps around Retiro Park`,
    },
  },
  heatmap: {
    ariaLabel: 'Activity over the last 52 weeks',
    dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    tooltip: {
      withKm: (km, dateLabel) => `${km.toFixed(1)} km — ${dateLabel}`,
      noActivity: (dateLabel) => `No activity — ${dateLabel}`,
    },
  },
  routes: {
    noneAvailable: 'No routes available',
    zones: 'Zones',
    loadingLocations: 'Loading locations…',
    noLocationData: 'No location data',
    unknown: 'Unknown',
  },
  partners: {
    together: (count) => `${count} run${count === 1 ? '' : 's'} together`,
  },
  sport: {
    times: (count) => `${count} time${count === 1 ? '' : 's'}`,
  },
  topPerformances: {
    longestRun: 'Longest run',
    bestPace: 'Best pace',
    mostElevation: 'Most elevation',
  },
}

export const messages: Record<Language, Messages> = {
  es: messagesEs,
  en: messagesEn,
}

