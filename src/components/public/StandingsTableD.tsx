'use client'
import { useTranslations } from 'next-intl'
import type { StandingD } from '@/types/database'

export default function StandingsTableD({ standings }: { standings: StandingD[] }) {
  const tc = useTranslations('tablesCommon')
  const t = useTranslations('tableD')
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[300px] border-collapse">
      <thead>
        <tr>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('rank')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('team')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{t('wdl')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{t('goals')}</th>
          <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{t('gd')}</th>
          <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{tc('points')}</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => {
          const isFinalist = row.rank <= 3
          return (
          <tr key={row.team.id} className={`border-b border-gray-100 last:border-0 ${isFinalist ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}`}>
            <td className="px-2 sm:px-6 py-2 sm:py-3 w-8">
              {isFinalist ? (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black">
                  {row.rank}
                </span>
              ) : (
                <span className="text-gray-400">{row.rank}</span>
              )}
            </td>
            <td className="px-2 sm:px-6 py-2 sm:py-3">
              <div className="flex items-center gap-2">
                <div className={`font-medium text-sm ${isFinalist ? 'text-amber-800' : 'text-blue-600'}`}>{row.team.name}</div>
                {isFinalist && (
                  <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                    → Finals
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{row.team.school}</div>
            </td>
            <td className="px-2 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.wins}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-amber-600">{row.draws}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-red-500">{row.losses}</span>
            </td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.goals_for}</span>
              <span className="text-gray-300 mx-1">:</span>
              <span className="text-red-500 font-semibold">{row.goals_against}</span>
            </td>
            <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3">
              <span className={row.goal_diff > 0 ? 'text-green-700 font-semibold' : row.goal_diff < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                {row.goal_diff > 0 ? '+' : ''}{row.goal_diff}
              </span>
            </td>
            <td className={`px-2 sm:px-6 py-2 sm:py-3 font-bold ${isFinalist ? 'text-amber-800' : 'text-gray-900'}`}>{row.points}</td>
          </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}
