const CATEGORIES = [
  { id: 'a', label: 'A · Line Follower', icon: '🏎️', desc: 'Enter run times and penalties' },
  { id: 'b', label: 'B · Mini Sumo',     icon: '🤼', desc: 'Record match results and round wins' },
  { id: 'c', label: 'C · MiniRoboWar',  icon: '⚔️', desc: 'Log fights — KO, Immobilization, Judge' },
  { id: 'd', label: 'D · Robo Football', icon: '⚽', desc: 'Enter match scores and goals' },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-10 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-gray-900 rounded-md flex items-center justify-center font-black text-[10px]">SFRC</div>
          <span className="text-sm font-bold">STARTUP FEST</span>
          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-3 py-1 rounded-full">⚖️ JUDGES PANEL</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/a" target="_blank" className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50">View Results ↗</a>
          <a href="/api/auth/logout" className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md border border-red-200 hover:bg-red-50">Log Out</a>
        </div>
      </header>

      <div className="px-10 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Results Management</h1>
        <p className="text-sm text-gray-500 mb-8">Select a category to add teams or enter results.</p>

        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {CATEGORIES.map(cat => (
            <a key={cat.id} href={`/judges/${cat.id}`}
              className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all group">
              <div className="text-3xl mb-3">{cat.icon}</div>
              <div className="text-sm font-bold text-gray-900 group-hover:text-amber-700 mb-1">{cat.label}</div>
              <div className="text-xs text-gray-500">{cat.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
