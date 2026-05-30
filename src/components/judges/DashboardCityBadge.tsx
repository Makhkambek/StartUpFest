'use client'
import { useEventSettings } from '@/lib/use-event-settings'

export function DashboardCityBadge() {
  const { cityName, settings } = useEventSettings('en')
  return (
    <span className="text-xs text-gray-400 dark:text-zinc-400">
      📍 {cityName} · {settings.year}
    </span>
  )
}
