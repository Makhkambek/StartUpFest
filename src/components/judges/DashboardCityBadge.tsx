'use client'
import { useEventSettings } from '@/lib/use-event-settings'

export function DashboardCityBadge() {
  const { cityName, settings } = useEventSettings('en')
  return (
    <span className="text-xs text-gray-400 dark:text-gray-500">
      📍 {cityName} · {settings.year}
    </span>
  )
}
