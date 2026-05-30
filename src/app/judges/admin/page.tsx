import Link from 'next/link'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

const LINKS = [
  {
    href: '/judges/admin/event-settings',
    label: 'Event Settings',
    desc: 'Set active city, year, and event name',
    icon: '🌍',
  },
  {
    href: '/judges/admin/teams',
    label: 'Teams',
    desc: 'Add, edit, or delete teams by category',
    icon: '🤖',
  },
  {
    href: '/judges/admin/users',
    label: 'Users',
    desc: 'Manage judge accounts and roles',
    icon: '👤',
  },
]

export default function AdminIndexPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-10">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <Link href="/judges/dashboard" className="text-sm text-emerald-600 hover:underline">
            ← Dashboard
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-3xl font-black mt-2">Admin</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Manage event configuration and participants.</p>
      </header>

      <div className="space-y-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow transition"
          >
            <span className="text-3xl">{l.icon}</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-zinc-100">{l.label}</div>
              <div className="text-sm text-gray-500 dark:text-zinc-400">{l.desc}</div>
            </div>
            <span className="ml-auto text-gray-400 dark:text-zinc-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
