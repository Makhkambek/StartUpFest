'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/a', label: 'Line Follower' },
  { href: '/b', label: 'Mini Sumo' },
  { href: '/c', label: 'MiniRoboWar' },
  { href: '/d', label: 'Robo Football' },
]

export default function CategoryTabs() {
  const path = usePathname()
  return (
    <div className="flex border-b border-gray-200 px-4">
      {TABS.map((tab) => {
        const active = path === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-[15px] text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'text-blue-600 border-blue-600 font-semibold'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
