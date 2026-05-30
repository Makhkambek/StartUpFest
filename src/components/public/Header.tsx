'use client'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
export default function Header() {
  const pathname = usePathname()
  const t = useTranslations('header')
  const linkClass = (active: boolean) =>
    `text-sm px-4 py-2 transition-colors ${active ? 'text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'}`

  return (
    <header className="bg-white border-b border-gray-200 h-14 sm:h-16 flex items-center px-4 sm:px-10 justify-between sticky top-0 z-10">
      <Link href="/" className="flex items-center gap-2 sm:gap-3 no-underline text-gray-900">
        <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-gray-900 rounded-md flex items-center justify-center font-black text-[10px] tracking-wide text-gray-900 shrink-0">
          SFRC
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 leading-tight">{t('brandLine1')}</div>
          <div className="text-[11px] text-gray-400 hidden sm:block">{t('brandLine2')}</div>
        </div>
      </Link>
      <nav className="hidden sm:flex items-center gap-1">
        <Link href="/about" className={linkClass(pathname === '/about')}>{t('navAbout')}</Link>
        <Link href="/challenge" className={linkClass(pathname === '/challenge')}>{t('navChallenge')}</Link>
      </nav>
    </header>
  )
}
