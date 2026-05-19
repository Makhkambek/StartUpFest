import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import Header from '@/components/public/Header'
import { Link } from '@/i18n/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  return { title: t('aboutTitle'), description: t('aboutDescription') }
}

type Achievement = { year: string; event: string; locKey: string; placeKey: string; tierKey: string }

const ACHIEVEMENTS: Achievement[] = [
  { year: '2024', event: 'FIRST Global Challenge',  locKey: 'locGreece', placeKey: 'place2nd',       tierKey: 'tierWorld' },
  { year: '2024', event: 'FIRST Global Challenge',  locKey: 'locPanama', placeKey: 'place4th',       tierKey: 'tierWorld' },
  { year: '2024', event: 'FTC China Open',          locKey: 'locChina',  placeKey: 'place3rd',       tierKey: 'tierInternational' },
  { year: '2024', event: 'Robotics Championship',   locKey: 'locDubai',  placeKey: 'place2nd',       tierKey: 'tierInternational' },
  { year: '2024', event: 'Teknofest International', locKey: 'locTurkey', placeKey: 'place3rd',       tierKey: 'tierInternational' },
  { year: '2024', event: 'CanSat',                  locKey: 'locSat',    placeKey: 'placeQualified', tierKey: 'tierInternational' },
  { year: '2025', event: 'MTI Robotics',            locKey: 'locUSA',    placeKey: 'place1stCAsia',  tierKey: 'tierHistoric' },
]

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'about' })

  return (
    <>
    <Header />
    <main className="bg-white min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="text-sm sm:text-base font-bold tracking-[0.15em] text-amber-600 uppercase mb-10 leading-tight">
            {t.rich('associationKicker', { br: () => <br /> })}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-[1.15] mb-8 max-w-4xl">
            {t('heroH1Part1')} <em className="italic">{t('heroH1Robots')}</em>{t('heroH1Part2')} <em className="italic">{t('heroH1Future')}</em>{t('heroH1Part3')}
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl leading-relaxed">{t('heroLead')}</p>
          <div className="mt-12 text-xs font-semibold text-gray-500 tracking-wider">{t('heroFooter')}</div>
        </div>
      </section>

      {/* ── Manifesto ────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <p className="text-xl sm:text-2xl text-gray-900 font-medium italic leading-relaxed">{t('manifesto')}</p>
        </div>
      </section>

      {/* ── The Association ──────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('associationKicker2')}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-10 max-w-3xl leading-tight">
            {t('associationH2')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-5 text-base text-gray-600 leading-relaxed max-w-4xl">
            <p>{t('associationP1')}</p>
            <p>{t('associationP2')}</p>
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 mt-14 pt-10 border-t border-gray-200">
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">{t('metaFounded')}</dt>
              <dd className="text-base font-bold text-gray-900">{t('metaFoundedValue')}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">{t('metaBasedIn')}</dt>
              <dd className="text-base font-bold text-gray-900">{t('metaBasedInValue')}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">{t('metaStatus')}</dt>
              <dd className="text-base font-bold text-gray-900">{t('metaStatusValue')}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">{t('metaFocus')}</dt>
              <dd className="text-base font-bold text-gray-900">{t('metaFocusValue')}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Track Record ─────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('trackRecordKicker')}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
            {t('trackRecordH2Part1')} <em className="italic">{t('trackRecordH2Em')}</em>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed max-w-3xl mb-12">{t('trackRecordLead')}</p>

          <div className="border-t border-gray-200">
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 py-5 border-b border-gray-200 items-baseline">
                <div className="col-span-2 sm:col-span-1 text-xs font-mono text-gray-400 tracking-tight">{a.year}</div>
                <div className="col-span-7 sm:col-span-8">
                  <div className="text-base font-bold text-gray-900 leading-tight">{a.event}</div>
                  <div className="text-xs text-gray-400 mt-0.5 tracking-wide uppercase">{t(a.locKey)} · {t(a.tierKey)}</div>
                </div>
                <div className="col-span-3 text-right text-lg sm:text-xl font-black text-amber-600 tracking-tight">{t(a.placeKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this matters ─────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('matters')}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] max-w-3xl">
            {t('mattersH2Line1')}<br />
            {t('mattersH2Line2')} <em className="italic">{t('mattersH2Em')}</em>{t('mattersH2End')}
          </h2>
        </div>
      </section>

      {/* ── Commitments ──────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('commitmentsKicker')}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-12 leading-tight">{t('commitmentsH2')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">01</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{t('commitment1Title')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t('commitment1Body')}</p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">02</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{t('commitment2Title')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t('commitment2Body')}</p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">03</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{t('commitment3Title')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t('commitment3Body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SFRC ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('sfrcKicker')}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">{t('sfrcH2')}</h2>
          <p className="text-base text-gray-500 max-w-3xl leading-relaxed mb-10">{t('sfrcLead')}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/challenge" className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-md font-semibold hover:bg-gray-800 transition-colors">
              {t('ctaExplore')}
            </Link>
            <Link href="/a" className="inline-flex items-center gap-2 text-gray-900 border border-gray-300 px-5 py-2.5 rounded-md font-semibold hover:bg-gray-50 transition-colors">
              {t('ctaResults')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────── */}
      <section>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 text-xs text-gray-400">{t('footerNote')}</div>
      </section>
    </main>
    </>
  )
}
