'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import polyline from '@mapbox/polyline'
import type { Map as LeafletMap, LatLngTuple } from 'leaflet'
import type { StravaSummaryActivity } from '@/types/strava'

interface Props {
  activities: StravaSummaryActivity[]
}

interface GeoResult {
  city: string
  country: string
  countryCode: string
}

interface CityNode {
  name: string
  routeIndices: number[]
}

interface CountryNode {
  name: string
  code: string
  cities: Map<string, CityNode>
}

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function roundCoord(n: number): number {
  return Math.round(n * 10) / 10
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function MapController({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  return null
}

function FitBounds({ routes }: { routes: LatLngTuple[][] }) {
  const map = useMap()
  useEffect(() => {
    const allPoints = routes.flat()
    if (allPoints.length === 0) return
    map.fitBounds(allPoints, { padding: [30, 30] })
  }, [map, routes])
  return null
}

export default function RouteMap({ activities }: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const [locationTree, setLocationTree] = useState<CountryNode[]>([])
  const [geocoding, setGeocoding] = useState(false)

  const routes: LatLngTuple[][] = activities
    .filter((a) => a.map?.summary_polyline)
    .map((a) => polyline.decode(a.map!.summary_polyline) as LatLngTuple[])
    .filter((r) => r.length > 0)

  const geocodeRoutes = useCallback(async () => {
    if (routes.length === 0) return
    setGeocoding(true)

    const seen = new Map<string, number>()
    for (let i = 0; i < routes.length; i++) {
      const [lat, lng] = routes[i][0]
      const key = `${roundCoord(lat)},${roundCoord(lng)}`
      if (!seen.has(key)) seen.set(key, i)
    }

    const uniquePoints = Array.from(seen.entries()).slice(0, 20)

    const geoMap = new Map<string, GeoResult>()
    for (let i = 0; i < uniquePoints.length; i++) {
      const [key] = uniquePoints[i]
      const [lat, lng] = key.split(',').map(Number)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        )
        const data = await res.json()
        geoMap.set(key, {
          city:
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            'Desconocido',
          country: data.address?.country || 'Desconocido',
          countryCode: (data.address?.country_code || '??').toUpperCase(),
        })
      } catch {
        geoMap.set(key, { city: 'Desconocido', country: 'Desconocido', countryCode: '??' })
      }
      if (i < uniquePoints.length - 1) await delay(1100)
    }

    const countries = new Map<string, CountryNode>()
    for (let i = 0; i < routes.length; i++) {
      const [lat, lng] = routes[i][0]
      const key = `${roundCoord(lat)},${roundCoord(lng)}`
      const geo = geoMap.get(key) ?? { city: 'Desconocido', country: 'Desconocido', countryCode: '??' }

      if (!countries.has(geo.country)) {
        countries.set(geo.country, { name: geo.country, code: geo.countryCode, cities: new Map() })
      }
      const country = countries.get(geo.country)!
      if (!country.cities.has(geo.city)) {
        country.cities.set(geo.city, { name: geo.city, routeIndices: [] })
      }
      country.cities.get(geo.city)!.routeIndices.push(i)
    }

    setLocationTree(Array.from(countries.values()))
    setGeocoding(false)
  }, [routes])

  useEffect(() => {
    geocodeRoutes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (routes.length === 0) {
    return (
      <p className="text-white/40 text-sm text-center py-8">
        No hay rutas disponibles
      </p>
    )
  }

  const zoomTo = (indices: number[]) => {
    const points = indices.flatMap((i) => routes[i])
    if (points.length > 0) mapRef.current?.fitBounds(points, { padding: [20, 20] })
  }

  return (
    <div className="flex gap-3 h-96">
      <div className="flex-1 rounded-2xl overflow-hidden">
        <MapContainer
          center={[40.4, -3.7]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapController mapRef={mapRef} />
          <FitBounds routes={routes} />
          {routes.map((positions, i) => (
            <Polyline
              key={i}
              positions={positions}
              color="#FC4C02"
              weight={2}
              opacity={0.4}
            />
          ))}
        </MapContainer>
      </div>

      <div className="w-52 flex-shrink-0 bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 overflow-y-auto">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Zonas
        </p>
        {geocoding ? (
          <p className="text-white/40 text-xs">Cargando ubicaciones…</p>
        ) : locationTree.length === 0 ? (
          <p className="text-white/40 text-xs">Sin datos de ubicación</p>
        ) : (
          locationTree.map((country) => {
            const allCountryIndices = Array.from(country.cities.values()).flatMap(
              (c) => c.routeIndices
            )
            const cities = Array.from(country.cities.values())
            return (
              <div key={country.name} className="mb-3">
                <button
                  onClick={() => zoomTo(allCountryIndices)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white w-full text-left mb-1"
                >
                  <span>{flagEmoji(country.code)}</span>
                  <span className="truncate">{country.name}</span>
                  <span className="ml-auto text-white/30 text-[10px] flex-shrink-0">
                    {allCountryIndices.length}
                  </span>
                </button>
                {cities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => zoomTo(city.routeIndices)}
                    className="flex items-center gap-1.5 w-full text-left text-xs text-white/50 hover:text-white/80 pl-5 py-0.5"
                  >
                    <span className="text-[10px]">📍</span>
                    <span className="truncate">{city.name}</span>
                    <span className="ml-auto text-white/20 flex-shrink-0">
                      {city.routeIndices.length}
                    </span>
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
