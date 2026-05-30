'use client'
import { useTranslations } from 'next-intl'
import type { StandingA } from '@/types/database'

function TimeCell({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-400 italic font-mono text-sm">—</span>
  const cls = v < 32 ? 'text-green-700 font-semibold' : v < 65 ? 'text-amber-600' : 'text-red-600'
  return <span className={`font-mono text-sm ${cls}`}>{v.toFixed(2)}s</span>
}

function StatusCell({ s }: { s: StandingA['status'] }) {
  const t = useTranslations('tablesCommon')
  const map = { finalist: 'text-amber-700 font-medium', qualified: 'text-green-700 font-medium', elim: 'text-gray-400', dnf: 'text-red-600', disq: 'text-red-600' }
  const labelKey = { finalist: 'statusFinalist', qualified: 'statusQualified', elim: 'statusElim', dnf: 'statusDnf', disq: 'statusDisq' } as const
  return <span className={map[s]}>{t(labelKey[s])}</span>
}

export default function StandingsTableA({ standings }: { standings: StandingA[] }) {
  const tc = useTranslations('tablesCommon')
  const ta = useTranslations('tableA')
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[320px] border-collapse">
      <thead>
        <tr>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('rank')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('team')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{ta('run1')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{ta('run2')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{ta('penalty')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{ta('finalTime')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('status')}</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => (
          <tr key={row.team.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
            <td className="px-2 sm:px-6 py-2 sm:py-3 text-gray-400 w-8">{row.rank}</td>
            <td className="px-2 sm:px-6 py-2 sm:py-3">
              <div className="text-blue-600 font-medium text-sm">{row.team.name}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{row.team.school}</div>
            </td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3"><TimeCell v={row.run1} /></td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3"><TimeCell v={row.run2} /></td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3">
              {row.penalty !== '0' && row.penalty !== 'dnf' && row.penalty !== 'disq'
                ? <span className="text-red-600 font-semibold">+{row.penalty}s</span>
                : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-2 sm:px-6 py-2 sm:py-3">
              {row.status === 'dnf' || row.status === 'disq'
                ? <span className="text-gray-400 italic font-mono text-sm">{row.status.toUpperCase()}</span>
                : row.total !== null
                  ? <strong className="font-mono text-sm">{row.total.toFixed(2)}s</strong>
                  : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-2 sm:px-6 py-2 sm:py-3"><StatusCell s={row.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
