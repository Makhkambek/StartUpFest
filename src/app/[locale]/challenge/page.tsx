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
  return { title: t('challengeTitle'), description: t('challengeDescription') }
}

type CategoryId = 'a' | 'b' | 'c' | 'd'
type Point = { title: string; body: string }
type Kv = { k: string; v: string }

const CATEGORIES: { id: CategoryId; key: 'catA' | 'catB' | 'catC' | 'catD'; accent: string; hasFirstBadge: boolean }[] = [
  { id: 'a', key: 'catA', accent: 'text-blue-600',    hasFirstBadge: false },
  { id: 'b', key: 'catB', accent: 'text-violet-600',  hasFirstBadge: true  },
  { id: 'c', key: 'catC', accent: 'text-rose-600',    hasFirstBadge: true  },
  { id: 'd', key: 'catD', accent: 'text-emerald-600', hasFirstBadge: true  },
]

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'challenge' })

  return (
    <>
    <Header />
    <main className="bg-white min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="text-sm sm:text-base font-bold tracking-[0.15em] text-amber-600 uppercase mb-10 leading-tight">
            {t.rich('heroKicker', { br: () => <br /> })}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-[1.15] mb-8 max-w-4xl">
            {t('heroH1Line1')}<br />
            {t('heroH1Line2')} <em className="italic">{t('heroH1Em')}</em> {t('heroH1Line3')}<br />
            {t('heroH1Line4')}
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl leading-relaxed">{t('heroLead')}</p>
          <nav className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6 text-sm">
            {CATEGORIES.map(c => (
              <a key={c.id} href={`#${c.id}`} className="group flex items-baseline gap-3 hover:text-gray-900 text-gray-500">
                <span className={`font-mono ${c.accent}`}>{c.id.toUpperCase()}</span>
                <span className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors">{t(`${c.key}.label`)}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── National firsts ──────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('firstsKicker')}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-12 max-w-3xl">
            {t('firstsH2Line1')}<br />
            {t('firstsH2Line2')} <em className="italic">{t('firstsH2Em')}</em> {t('firstsH2End')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <div className="text-xs font-mono text-amber-600 mb-3">{t(`first${n}Tag`)}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{t(`first${n}Title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`first${n}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      {CATEGORIES.map(c => {
        const unique = t.raw(`${c.key}.unique`) as Point[]
        const format = t.raw(`${c.key}.format`) as string[]
        const specs = t.raw(`${c.key}.specs`) as Kv[]
        const arena = t.raw(`${c.key}.arena`) as Kv[]
        const label = t(`${c.key}.label`)

        return (
          <section key={c.id} id={c.id} className="border-b border-gray-200 scroll-mt-16 sm:scroll-mt-20">
            <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">

              {/* Header */}
              <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
                <span className={c.accent}>{t(`${c.key}.catLabel`)}</span> · {t(`${c.key}.type`)}
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
                {label}.<br />
                <span className="text-gray-500 font-medium italic">{t(`${c.key}.tagline`)}</span>
              </h2>
              {c.hasFirstBadge && (
                <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-600 mb-12">
                  <span>★</span><span className="uppercase tracking-widest">{t(`${c.key}.firstBadge`)}</span>
                </div>
              )}

              {/* What stands out */}
              <div className="mt-10 mb-14">
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6">
                  {t('sectionStandsOut')}
                </div>
                <div className="space-y-6">
                  {unique.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 sm:gap-6 pb-6 border-b border-gray-100 last:border-0">
                      <div className="col-span-12 sm:col-span-1 text-xs font-mono text-amber-600">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="col-span-12 sm:col-span-11">
                        <div className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 leading-snug">{p.title}</div>
                        <div className="text-sm text-gray-500 leading-relaxed">{p.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="mb-14">
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                  {t('sectionFormat')}
                </div>
                <ul className="space-y-2 text-base text-gray-700 leading-relaxed max-w-3xl">
                  {format.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-mono text-amber-600 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Specs + Arena */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                    {t('sectionSpecs')}
                  </div>
                  <dl className="space-y-2">
                    {specs.map((s, i) => (
                      <div key={i} className="grid grid-cols-3 gap-3 text-sm pb-2 border-b border-gray-100">
                        <dt className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">{s.k}</dt>
                        <dd className="col-span-2 text-gray-800 font-medium">{s.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                    {t('sectionArena')}
                  </div>
                  <dl className="space-y-2">
                    {arena.map((s, i) => (
                      <div key={i} className="grid grid-cols-3 gap-3 text-sm pb-2 border-b border-gray-100">
                        <dt className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">{s.k}</dt>
                        <dd className="col-span-2 text-gray-800 font-medium">{s.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-12 pt-6 border-t border-gray-200 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-400">{t('ctaTeams')}</span>
                <Link href={`/${c.id}`} className="text-sm font-bold text-gray-900 hover:text-amber-600 transition-colors">
                  {t('ctaView', { label })}
                </Link>
              </div>
            </div>
          </section>
        )
      })}

      {/* ── Closing ──────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('closingKicker')}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
            {t('closingH2Line1')} <em className="italic">{t('closingH2Em')}</em>{t('closingH2End')}
          </h2>
          <p className="text-base text-gray-500 max-w-3xl leading-relaxed mb-10">{t('closingLead')}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/about" className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-md font-semibold hover:bg-gray-800 transition-colors">
              {t('ctaAbout')}
            </Link>
            <Link href="/a" className="inline-flex items-center gap-2 text-gray-900 border border-gray-300 px-5 py-2.5 rounded-md font-semibold hover:bg-gray-50 transition-colors">
              {t('ctaResults')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <section>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 text-xs text-gray-400">{t('footer')}</div>
      </section>
    </main>
    </>
  )
}
