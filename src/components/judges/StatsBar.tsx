'use client'

interface StatsBarProps {
  done: number
  total: number
  label?: string
}

export function StatsBar({ done, total, label = 'Matches' }: StatsBarProps) {
  const remaining = Math.max(0, total - done)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-4 items-baseline">
          <div>
            <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">{done}</span>
            <span className="text-sm text-gray-400 dark:text-zinc-400 font-mono"> / {total}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-400">{label} recorded</span>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-gray-500 dark:text-zinc-400">
            Remaining: <span className="font-bold text-gray-900 dark:text-zinc-100">{remaining}</span>
          </span>
          <span className="text-amber-700 dark:text-amber-400 font-bold">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
