import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { city?: string }
  const city = body.city
  if (!city?.trim()) return Response.json({ error: 'City is required' }, { status: 400 })

  const apiKey = process.env.OPENWEATHERMAP_API_KEY
  if (!apiKey) return Response.json({ error: 'Weather API not configured' }, { status: 500 })

  const geoRes = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
  )
  if (!geoRes.ok) return Response.json({ error: 'Geocoding failed' }, { status: 502 })

  const geoData = await geoRes.json() as Array<{ lat: number; lon: number; name: string }>
  if (!geoData.length) return Response.json({ error: 'City not found' }, { status: 404 })

  const { lat, lon } = geoData[0]
  return Response.json({ lat, lng: lon })
}
