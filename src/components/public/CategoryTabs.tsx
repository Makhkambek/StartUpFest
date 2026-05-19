'use client'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const TABS = ['a', 'b', 'c', 'd'] as const

export default function CategoryTabs() {
  const path = usePathname()
  const t = useTranslations('categoryTabs')
  return (
    <div className="flex border-b border-gray-200 px-2 sm:px-4 overflow-x-auto">
      {TABS.map((id) => {
        const href = `/${id}`
        const active = path === href
        return (
          <Link
            key={id}
            href={href}
            className={`px-3 sm:px-4 py-3 sm:py-[15px] text-xs sm:text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'text-blue-600 border-blue-600 font-semibold'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            {t(id)}
          </Link>
        )
      })}
    </div>
  )
}
