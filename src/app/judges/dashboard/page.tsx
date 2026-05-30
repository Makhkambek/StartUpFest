import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { DashboardCityBadge } from '@/components/judges/DashboardCityBadge'

const ALL_CATEGORIES = [
  {
    id: 'a',
    label: 'Line Follower',
    full: 'A · Line Follower',
    icon: '🏎️',
    color: 'border-l-blue-500',
    desc: 'Qualification & final runs — record time and penalties per match',
  },
  {
    id: 'b',
    label: 'Mini Sumo',
    full: 'B · Mini Sumo',
    icon: '🤼',
    color: 'border-l-purple-500',
    desc: 'Match-based — record winner, rounds, starting position',
  },
  {
    id: 'c',
    label: 'MiniRoboWar',
    full: 'C · MiniRoboWar',
    icon: '⚔️',
    color: 'border-l-red-500',
    desc: 'Fight-based — KO, Immobilization or Judge Decision',
  },
  {
    id: 'd',
    label: 'Robo Football',
    full: 'D · Robo Football',
    icon: '⚽',
    color: 'border-l-green-500',
    desc: 'Group & knockout matches — record score per match',
  },
]

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/judges/login')

  const categories = ALL_CATEGORIES.filter(c => session.categories.includes(c.id))

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-8 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-900 dark:border-gray-100 rounded flex items-center justify-center font-black text-[9px] dark:text-gray-100">SFRC</div>
          <span className="font-black text-sm tracking-wide dark:text-gray-100">STARTUP FEST</span>
          <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">JUDGES PANEL</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 dark:text-gray-500">@{session.username}</span>
          {session.role === 'admin' && (
            <>
              <a href="/judges/admin/teams" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Teams</a>
              <a href="/judges/admin/users" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Judges</a>
              <a href="/judges/admin/event-settings" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">⚙️ Region</a>
            </>
          )}
          <a href="/display" target="_blank" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Display ↗</a>
          <a href="/a" target="_blank" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Public ↗</a>
          <form action="/api/auth/logout" method="post" className="inline">
            <button type="submit" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2.5 py-1.5 rounded border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950">Log Out</button>
          </form>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 sm:px-8 py-4 sm:py-8">
        <div className={`mb-6 ${categories.length === 1 ? 'text-center' : 'text-center'}`}>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
            {categories.length === 1
              ? `${categories[0].icon} ${categories[0].full}`
              : 'Judges Dashboard'}
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-2 justify-center">
            <span>{session.role === 'admin'
              ? 'Admin — full access to all categories'
              : `Assigned to ${categories.map(c => c.id.toUpperCase()).join(', ')}`}
            </span>
            <DashboardCityBadge />
          </p>
        </div>

        <div className={categories.length === 1
          ? 'w-full max-w-sm'
          : 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl w-full'}>
          {categories.map(cat => (
            <a key={cat.id} href={`/judges/${cat.id}`}
              className={`bg-white dark:bg-gray-900 rounded-xl border-l-4 ${cat.color} border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md dark:hover:bg-gray-800/50 transition-all group flex flex-col gap-3 ${categories.length === 1 ? 'p-7' : 'p-5 min-h-[80px]'}`}>
              <div className="flex items-start justify-between">
                <span className={categories.length === 1 ? 'text-4xl' : 'text-3xl'}>{cat.icon}</span>
                <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors">CAT {cat.id.toUpperCase()}</span>
              </div>
              <div>
                <div className={`font-black text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-white ${categories.length === 1 ? 'text-lg' : 'text-base'}`}>{cat.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5">{cat.desc}</div>
              </div>
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:translate-x-0.5 transition-transform">
                Open →
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
