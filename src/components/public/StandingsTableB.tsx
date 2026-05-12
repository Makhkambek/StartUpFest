import type { StandingB } from '@/types/database'

const STATUS_CLS = { finalist: 'text-amber-700 font-medium', qualified: 'text-green-700 font-medium', elim: 'text-gray-400' }
const STATUS_LABEL = { finalist: 'Finalist', qualified: 'Qualified', elim: 'Eliminated' }

export default function StandingsTableB({ standings }: { standings: StandingB[] }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[540px] border-collapse">
      <thead>
        <tr>
          {['Rank', 'Team', 'Group', 'W / D / L', 'Round Wins', 'Points', 'Status'].map((h) => (
            <th key={h} className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => (
          <tr key={row.team.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
            <td className="px-3 sm:px-6 py-2 sm:py-3 text-gray-400 w-12">{row.rank}</td>
            <td className="px-3 sm:px-6 py-2 sm:py-3">
              <div className="text-blue-600 font-medium text-sm">{row.team.name}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{row.team.school}</div>
            </td>
            <td className="px-3 sm:px-6 py-2 sm:py-3 text-gray-700">Group {row.team.group_letter}</td>
            <td className="px-3 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.wins}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-amber-600">{row.draws}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-red-500">{row.losses}</span>
            </td>
            <td className="px-3 sm:px-6 py-2 sm:py-3 text-gray-800">{row.round_wins}</td>
            <td className="px-3 sm:px-6 py-2 sm:py-3 font-semibold text-gray-900">{row.points}</td>
            <td className="px-3 sm:px-6 py-2 sm:py-3"><span className={STATUS_CLS[row.status]}>{STATUS_LABEL[row.status]}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
