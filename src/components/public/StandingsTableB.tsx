'use client'
import { useTranslations } from 'next-intl'
import type { StandingB } from '@/types/database'

const STATUS_CLS = { finalist: 'text-amber-700 font-medium', qualified: 'text-green-700 font-medium', elim: 'text-gray-400' }
const STATUS_LABEL_KEY = { finalist: 'statusFinalist', qualified: 'statusQualified', elim: 'statusElim' } as const

export default function StandingsTableB({ standings }: { standings: StandingB[] }) {
  const tc = useTranslations('tablesCommon')
  const tb = useTranslations('tableB')
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[320px] border-collapse">
      <thead>
        <tr>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('rank')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('team')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{tb('group')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{tb('wdl')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{tb('roundWins')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('points')}</th>
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
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-gray-700">{tb('groupPrefix', { letter: row.team.group_letter ?? '—' })}</td>
            <td className="px-2 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.wins}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-amber-600">{row.draws}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-red-500">{row.losses}</span>
            </td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-gray-800">{row.round_wins}</td>
            <td className="px-2 sm:px-6 py-2 sm:py-3 font-semibold text-gray-900">{row.points}</td>
            <td className="px-2 sm:px-6 py-2 sm:py-3"><span className={STATUS_CLS[row.status]}>{tc(STATUS_LABEL_KEY[row.status])}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
