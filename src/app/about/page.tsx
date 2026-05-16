import type { Metadata } from 'next'
import Header from '@/components/public/Header'

export const metadata: Metadata = {
  title: 'About — Robotics & Engineering Association of Uzbekistan',
  description: 'About the Robotics and Engineering Association of Uzbekistan and the Startup Fest Robotics Challenge 2026.',
}

const ACHIEVEMENTS = [
  { year: '2024', event: 'FIRST Global Challenge', location: 'Greece',  place: '2nd', tier: 'World Championship' },
  { year: '2024', event: 'FIRST Global Challenge', location: 'Panama',  place: '4th', tier: 'World Championship' },
  { year: '2024', event: 'FTC China Open',         location: 'China',   place: '3rd', tier: 'International' },
  { year: '2024', event: 'Robotics Championship',  location: 'Dubai',   place: '2nd', tier: 'International' },
  { year: '2024', event: 'Teknofest International', location: 'Turkey', place: '3rd', tier: 'International' },
  { year: '2024', event: 'CanSat',                 location: 'Satellite Competition', place: 'Qualified', tier: 'International' },
  { year: '2025', event: 'MTI Robotics',           location: 'USA',     place: '1st from C.Asia', tier: 'Historic First' },
]

export default function AboutPage() {
  return (
    <>
    <Header />
    <main className="bg-white min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="text-sm sm:text-base font-bold tracking-[0.15em] text-amber-600 uppercase mb-10 leading-tight">
            Robotics &amp; Engineering<br />Association of Uzbekistan
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-[1.15] mb-8 max-w-4xl">
            We don&apos;t just build <em className="italic">robots</em>.<br />
            We&apos;re building the engineers who&apos;ll build <em className="italic">Uzbekistan&apos;s future</em>.
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl leading-relaxed">
            Robotics is just the language. The mission is bigger — preparing a generation
            to invent, design and lead the technology of the next fifty years.
          </p>
          <div className="mt-12 text-xs font-semibold text-gray-500 tracking-wider">
            Founded November 2025 &nbsp;·&nbsp; Tashkent → Panama → MTI in one year
          </div>
        </div>
      </section>

      {/* ── Manifesto ────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <p className="text-xl sm:text-2xl text-gray-900 font-medium italic leading-relaxed">
            &ldquo;For decades, world-class robotics felt like something that happens
            somewhere else. We&apos;re here to change that.&rdquo;
          </p>
        </div>
      </section>

      {/* ── The Association ──────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            The Association
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-10 max-w-3xl leading-tight">
            A national non-profit dedicated to robotics, engineering and STEM.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-5 text-base text-gray-600 leading-relaxed max-w-4xl">
            <p>
              We prepare and send Uzbek teams to international competitions — FIRST Global,
              FIRST Tech Challenge, Teknofest, CanSat, MTI robotics — and run national-scale
              events like the Startup Fest Robotics Challenge to give every student a stage at home.
            </p>
            <p>
              Beyond competitions, we mentor coaches, equip schools, and connect young engineers
              with universities, industry partners and global STEM programs.
            </p>
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 mt-14 pt-10 border-t border-gray-200">
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">Founded</dt>
              <dd className="text-base font-bold text-gray-900">November 2025</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">Based in</dt>
              <dd className="text-base font-bold text-gray-900">Tashkent, Uzbekistan</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">Status</dt>
              <dd className="text-base font-bold text-gray-900">National NGO</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1.5">Focus</dt>
              <dd className="text-base font-bold text-gray-900">Robotics &amp; STEM</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Track Record ─────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            Track Record · 7 podiums &amp; firsts
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
            Greece. Panama. China. Dubai. Turkey. America. <em className="italic">All in one year.</em>
          </h2>
          <p className="text-base text-gray-500 leading-relaxed max-w-3xl mb-12">
            Each result is a student who walked onto a global stage and proved that
            where you&apos;re from doesn&apos;t cap how far you can go.
          </p>

          <div className="border-t border-gray-200">
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 py-5 border-b border-gray-200 items-baseline">
                <div className="col-span-2 sm:col-span-1 text-xs font-mono text-gray-400 tracking-tight">{a.year}</div>
                <div className="col-span-7 sm:col-span-8">
                  <div className="text-base font-bold text-gray-900 leading-tight">{a.event}</div>
                  <div className="text-xs text-gray-400 mt-0.5 tracking-wide uppercase">{a.location} · {a.tier}</div>
                </div>
                <div className="col-span-3 text-right text-lg sm:text-xl font-black text-amber-600 tracking-tight">{a.place}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this matters ─────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            Why this matters
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] max-w-3xl">
            Engineering changes countries.<br />
            We&apos;re starting with <em className="italic">ours</em>.
          </h2>
        </div>
      </section>

      {/* ── Commitments ──────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            What we do
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-12 leading-tight">
            Three commitments. Zero compromises.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">01</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Open the door for every region
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Robotics shouldn&apos;t be a Tashkent privilege. We bring world-class STEM events to
                students across all of Uzbekistan — not just the capital.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">02</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Send our teams to win
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                We train teams to compete at the very top — Panama, Athens, Houston, MTI, Istanbul.
                The flag goes higher every year.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">03</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Build a generation, not a moment
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                We mentor coaches, equip schools, and connect young engineers to universities,
                industry partners and global STEM programs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SFRC ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            And now — a stage at home
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
            The Startup Fest Robotics Challenge.
          </h2>
          <p className="text-base text-gray-500 max-w-3xl leading-relaxed mb-10">
            SFRC 2026 is our country&apos;s first multi-category robotics championship —
            four disciplines, custom-built arenas, live scoring, formats borrowed from the
            best leagues in the world.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/challenge" className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-md font-semibold hover:bg-gray-800 transition-colors">
              Explore the Challenge →
            </a>
            <a href="/a" className="inline-flex items-center gap-2 text-gray-900 border border-gray-300 px-5 py-2.5 rounded-md font-semibold hover:bg-gray-50 transition-colors">
              View Live Results
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────── */}
      <section>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 text-xs text-gray-400">
          Robotics and Engineering Association of Uzbekistan · Founded November 2025 · Tashkent, Uzbekistan
        </div>
      </section>
    </main>
    </>
  )
}
