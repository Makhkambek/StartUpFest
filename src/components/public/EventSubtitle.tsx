'use client'
import { useEventSettings } from '@/lib/use-event-settings'

const COUNTRY: Record<'en' | 'ru' | 'uz', string> = {
  en: 'Uzbekistan',
  ru: 'Узбекистан',
  uz: "O'zbekiston",
}

export default function EventSubtitle({ locale }: { locale: string }) {
  const lang = (locale === 'ru' || locale === 'uz') ? locale : 'en'
  const { cityName, settings } = useEventSettings(lang)
  return (
    <p className="text-sm text-gray-500">
      {cityName}, {COUNTRY[lang]} · {settings.year}
    </p>
  )
}
