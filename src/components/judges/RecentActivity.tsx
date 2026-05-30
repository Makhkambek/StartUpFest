'use client'
import { useRouter } from 'next/navigation'

export interface RecentEntry {
  matchId: string
  scheduleId: string
  team: string
  result: string
  ts: string
}

interface RecentActivityProps {
  category: 'a' | 'b' | 'c' | 'd'
  entries: RecentEntry[]
  limit?: number
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export function RecentActivity({ category, entries, limit = 5 }: RecentActivityProps) {
  const router = useRouter()
  const sorted = [...entries]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, limit)

  if (sorted.length === 0) return null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide">Recent Activity</h3>
        <span className="text-[10px] text-gray-400 dark:text-zinc-400">Last {sorted.length}</span>
      </div>
      <div className="space-y-1.5">
        {sorted.map((e, i) => (
          <button
            key={`${e.scheduleId}-${i}`}
            onClick={() => router.push(`/judges/${category}/record/${e.scheduleId}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left">
            <span className="font-mono font-black text-xs text-gray-700 dark:text-zinc-300 w-14">{e.matchId}</span>
            <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300 truncate">{e.team}</span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-zinc-100">{e.result}</span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-400 w-16 text-right">{relativeTime(e.ts)}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide hover:underline">Edit</span>
          </button>
        ))}
      </div>
    </div>
  )
}
