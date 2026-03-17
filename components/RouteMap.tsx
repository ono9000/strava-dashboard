'use client'

import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import polyline from '@mapbox/polyline'
import type { StravaSummaryActivity } from '@/types/strava'
import type { LatLngTuple } from 'leaflet'

interface Props {
  activities: StravaSummaryActivity[]
}

function FitBounds({ routes }: { routes: LatLngTuple[][] }) {
  const map = useMap()
  useEffect(() => {
    const allPoints = routes.flat()
    if (allPoints.length === 0) return
    map.fitBounds(allPoints)
  }, [map, routes])
  return null
}

export default function RouteMap({ activities }: Props) {
  const routes: LatLngTuple[][] = activities
    .filter((a) => a.map?.summary_polyline)
    .map((a) => polyline.decode(a.map!.summary_polyline) as LatLngTuple[])
    .filter((r) => r.length > 0)

  if (routes.length === 0) {
    return (
      <p className="text-white/40 text-sm text-center py-8">
        No hay rutas disponibles
      </p>
    )
  }

  return (
    <MapContainer
      center={[40.4, -3.7]}
      zoom={6}
      className="h-96 rounded-2xl overflow-hidden"
      zoomControl={true}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
      />
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
  )
}
