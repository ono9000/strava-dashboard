import { render, screen, waitFor } from '@testing-library/react'

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: () => <div data-testid="polyline" />,
  GeoJSON: () => <div data-testid="geojson-layer" />,
  useMap: () => ({ fitBounds: jest.fn() }),
}))

jest.mock('@mapbox/polyline', () => ({
  decode: (str: string) => {
    if (!str) return []
    return [[40.4, -3.7], [41.4, -2.7]]
  },
}))

global.fetch = jest.fn().mockResolvedValue({
  json: async () => ({
    address: {
      city: 'Madrid',
      country: 'España',
      country_code: 'es',
    },
  }),
}) as jest.Mock

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
  beforeEach(() => jest.clearAllMocks())

  it('renders the map container when activities have polylines', () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows fallback when no activities have polylines', () => {
    render(<RouteMap activities={[makeActivity(''), makeActivity(null)]} />)
    expect(screen.getByText(/No hay rutas disponibles/i)).toBeInTheDocument()
  })

  it('shows loading state while geocoding', () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument()
  })

  it('shows city name after geocoding resolves', async () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    await waitFor(() => {
      expect(screen.getByText('Madrid')).toBeInTheDocument()
    })
  })
})
