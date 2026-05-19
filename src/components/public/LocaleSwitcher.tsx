'use client'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { useTransition } from 'react'

const LABEL: Record<string, string> = { en: 'EN', ru: 'RU', uz: 'UZ' }

export default function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: string) {
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div className="flex items-center gap-0.5 text-xs font-bold" aria-label="Language">
      {routing.locales.map((l) => {
        const active = l === locale
        return (
          <button
            key={l}
            onClick={() => switchTo(l)}
            disabled={isPending}
            aria-current={active ? 'true' : undefined}
            className={`px-2 py-1 rounded transition-colors ${
              active
                ? 'text-gray-900 bg-gray-100'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
            } ${isPending ? 'opacity-50' : ''}`}
          >
            {LABEL[l] ?? l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
