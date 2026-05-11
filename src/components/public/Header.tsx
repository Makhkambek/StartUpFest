export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-10 justify-between sticky top-0 z-10">
      <a href="/" className="flex items-center gap-3 no-underline text-gray-900">
        <div className="w-10 h-10 border-2 border-gray-900 rounded-md flex items-center justify-center font-black text-[10px] tracking-wide text-gray-900">
          SFRC
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 leading-tight">STARTUP FEST</div>
          <div className="text-[11px] text-gray-400">Robotics Challenge</div>
        </div>
      </a>
      <nav className="flex items-center gap-1">
        <a href="#" className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900">About</a>
        <a href="#" className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900">The Challenge</a>
        <a href="/judges/login" className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900">Judges</a>
      </nav>
    </header>
  )
}
