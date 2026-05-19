'use client'
import { useEffect, useState, useCallback } from 'react'
import type { EventSettings } from '@/types/database'
import { findCity, cityLabel, DEFAULT_CITY_CODE, type UzCity } from './cities'

// Defaults used until the first fetch resolves. Keeps SSR/early render stable.
const FALLBACK: EventSettings = {
  id: 1,
  city_code: DEFAULT_CITY_CODE,
  year: new Date().getFullYear(),
  event_name: null,
  updated_at: new Date().toISOString(),
}

const POLL_MS = 30_000

export interface ResolvedEventSettings {
  settings: EventSettings
  city: UzCity
  cityName: string                // localized
  watermark: string               // "BUXORO · 2026" — for footers
  refresh: () => void
}

export function useEventSettings(locale: 'en' | 'ru' | 'uz' = 'en'): ResolvedEventSettings {
  const [settings, setSettings] = useState<EventSettings>(FALLBACK)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/event/settings', { cache: 'no-store' })
      if (res.ok) setSettings(await res.json())
    } catch {}
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const city = findCity(settings.city_code)
  const cityName = cityLabel(city, locale)
  const watermark = `${cityName.toUpperCase()} · ${settings.year}`

  return { settings, city, cityName, watermark, refresh }
}
