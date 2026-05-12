export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 h-14 sm:h-16 flex items-center px-4 sm:px-10 justify-between sticky top-0 z-10">
      <a href="/" className="flex items-center gap-2 sm:gap-3 no-underline text-gray-900">
        <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-gray-900 rounded-md flex items-center justify-center font-black text-[10px] tracking-wide text-gray-900 shrink-0">
          SFRC
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 leading-tight">STARTUP FEST</div>
          <div className="text-[11px] text-gray-400 hidden sm:block">Robotics Challenge</div>
        </div>
      </a>
      <nav className="hidden sm:flex items-center gap-1">
        <a href="#" className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900">About</a>
        <a href="#" className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900">The Challenge</a>
      </nav>
    </header>
  )
}
