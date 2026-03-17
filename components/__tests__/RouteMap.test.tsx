import { render, screen } from '@testing-library/react'

// Mock react-leaflet — the map itself is not testable in jsdom
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({ fitBounds: jest.fn() }),
}))

jest.mock('@mapbox/polyline', () => ({
  decode: (str: string) => {
    if (!str) return []
    return [[40.4, -3.7], [41.4, -2.7]]
  },
}))

import RouteMap from '../RouteMap'
import type { StravaSummaryActivity } from '@/types/strava'

const makeActivity = (polyline: string | null): StravaSummaryActivity => ({
  id: 1,
  name: 'Test',
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1600,
  total_elevation_gain: 50,
  sport_type: 'Run',
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T09:00:00+01:00',
  map: polyline !== null ? { summary_polyline: polyline } : null,
})

describe('RouteMap', () => {
  it('renders the map when activities have polylines', () => {
    const activities = [makeActivity('encoded_polyline_data')]
    render(<RouteMap activities={activities} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows fallback text when no activities have polylines', () => {
    const activities = [
      makeActivity(''),      // empty polyline (private activity)
      makeActivity(null),    // null map
    ]
    render(<RouteMap activities={activities} />)
    expect(screen.getByText(/No hay rutas disponibles/i)).toBeInTheDocument()
  })
})
