import type { StandingD } from '@/types/database'

export default function StandingsTableD({ standings }: { standings: StandingD[] }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[440px] border-collapse">
      <thead>
        <tr>
          {['Rank', 'Team', 'W / D / L', 'Goals', 'GD', 'Points'].map((h) => (
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
            <td className="px-3 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.wins}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-amber-600">{row.draws}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-red-500">{row.losses}</span>
            </td>
            <td className="px-3 sm:px-6 py-2 sm:py-3">
              <span className="text-green-700 font-semibold">{row.goals_for}</span>
              <span className="text-gray-300 mx-1">:</span>
              <span className="text-red-500 font-semibold">{row.goals_against}</span>
            </td>
            <td className="px-3 sm:px-6 py-2 sm:py-3">
              <span className={row.goal_diff > 0 ? 'text-green-700 font-semibold' : row.goal_diff < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                {row.goal_diff > 0 ? '+' : ''}{row.goal_diff}
              </span>
            </td>
            <td className="px-3 sm:px-6 py-2 sm:py-3 font-bold text-gray-900">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
