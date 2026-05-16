import type { Metadata } from 'next'
import Header from '@/components/public/Header'

export const metadata: Metadata = {
  title: 'The Challenge — SFRC 2026',
  description: 'Four disciplines, four custom-built arenas. Discover what makes each SFRC 2026 category unique.',
}

type Point = { title: string; body: string }

type CategoryDef = {
  id: 'a' | 'b' | 'c' | 'd'
  label: string
  catLabel: string
  type: string
  tagline: string
  accent: string
  firstBadge: string | null
  unique: Point[]
  format: string[]
  specs: { k: string; v: string }[]
  arena: { k: string; v: string }[]
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'a',
    label: 'Line Follower',
    catLabel: 'Category A',
    type: 'Fast Line Following Robot',
    tagline: 'Autonomous chase on an elevated track with laser timing.',
    accent: 'text-blue-600',
    firstBadge: null,
    unique: [
      {
        title: 'Elevated platform with RGB underglow',
        body: 'The 5490 × 2745 mm track sits on a ~30 cm raised platform with a WS2812B LED strip running underglow around the perimeter and flashing white on finish.',
      },
      {
        title: 'Arduino laser-gate timing',
        body: 'Custom laser gates measure start and finish using Arduino micros(). The result shows on a 7-segment display and triggers an RGB flash and Wi-Fi update to the website.',
      },
      {
        title: 'Drag Race finals on mirrored tracks',
        body: 'Top-4 qualifiers race head-to-head on identical mirrored tracks in a Double Elimination format. One run per match, finish determined visually by judges. Places 1–4 awarded.',
      },
      {
        title: 'Real track features',
        body: 'Crossroads (diamond shape), a diagonal bridge crossing, and 4–5 U-turn serpentines along the full track. White line 19–25 mm on a black background.',
      },
      {
        title: '10-second self-recovery rule',
        body: 'If a robot leaves the track, it has 10 seconds to return on its own with no penalty. Fail to recover → manually placed behind the line with +20s penalty (one time per attempt). Second slip → attempt disqualified.',
      },
    ],
    format: [
      'Level 1 (Qualification): Loop Track, 2 attempts per team, ranked by average time. Top-4 advance.',
      'Level 2 (Finals): Face-to-Face Drag Race on mirrored tracks, Double Elimination, places 1–4 awarded.',
      'Per attempt: maximum 2 minutes, 5-minute window to reach the judge after being called.',
      'Tiebreaker: equal time → compare penalty seconds → extra run.',
    ],
    specs: [
      { k: 'Format',      v: 'Fully autonomous · No remote allowed' },
      { k: 'Robot size',  v: '25 × 20 × 20 cm' },
      { k: 'Max weight',  v: '1.5 kg with battery' },
      { k: 'Power',       v: 'Internal battery, up to 12V DC' },
      { k: 'Controllers', v: 'Arduino · ESP32 · STM32 · RPi Pico' },
      { k: 'Sensors',     v: 'IR · ToF · photodiode (≤8 ch) · encoders · IMU' },
      { k: 'Penalties',   v: '+20s (slip), +40s (no start in 30s), DNF = 120s + penalties' },
      { k: 'Banned',      v: 'Cameras · Wi-Fi/BT · magnets · glue · suction · fans' },
    ],
    arena: [
      { k: 'Track',         v: '5490 × 2745 mm, white line 19–25 mm on black' },
      { k: 'Platform',      v: '~30 cm elevated, ~6590 × 3845 mm total' },
      { k: 'Green zone',    v: '50 cm border around track' },
      { k: 'Safety border', v: '~8 cm rail around platform' },
      { k: 'RGB',           v: 'WS2812B underglow (rainbow cycle), white flash on finish' },
      { k: 'Timing',        v: 'Arduino laser gates with micros() resolution, 7-segment display' },
      { k: 'Access',        v: '2 wooden staircases, 3 steps × ~10 cm' },
    ],
  },
  {
    id: 'b',
    label: 'Mini Sumo',
    catLabel: 'Category B',
    type: 'Autonomous Mini Sumo',
    tagline: 'The last robot standing — Yuhkoh wins.',
    accent: 'text-violet-600',
    firstBadge: 'First standardised Mini Sumo championship in Uzbekistan',
    unique: [
      {
        title: 'Yuhkoh — complete push-out',
        body: 'Victory is awarded only when the opponent is fully pushed out of the ring. The Japanese term Yuhkoh defines the win condition — no points, no judges, no doubt.',
      },
      {
        title: 'Mandatory 5-second start delay',
        body: 'Every match starts with a 5-second delay after the signal. Strategy and reaction logic, not just being faster off the line. False start → foul; second foul in match → round loss.',
      },
      {
        title: 'Three randomised starting positions',
        body: 'Face-to-Face, Side-by-Side, or Back-to-Back — judge announces the configuration before each round. A robot has to dominate from every angle.',
      },
      {
        title: 'Three-phase tournament with Triangle Duel finals',
        body: 'Six groups round-robin → 12-team Single Elimination → Triangle Duel Finals where three finalists fight pairwise (A vs B, B vs C, A vs C). Standings by total wins.',
      },
      {
        title: 'Full dohyō stage with Shiro-Tawara and Shikiri',
        body: '770 mm ring with 2.5 cm white Shiro-Tawara edge, two 2 × 8 cm Shikiri lines 20 cm apart, on a ~50 cm platform with an RGB rainbow strip and 50 cm green zone.',
      },
    ],
    format: [
      'Phase 1: Six groups, round-robin, best-of-3 matches per pair.',
      'Phase 2: Top-2 from each group → 12-team Single Elimination → 3 finalists.',
      'Phase 3: Triangle Duel — A vs B · B vs C · A vs C, ranked by total wins. Tiebreaker: Golden Match — first robot out loses.',
      'Match interruptions: clinch > 10s → restart; both stuck 15s → restart; second occurrence → draw.',
    ],
    specs: [
      { k: 'Format',      v: 'Fully autonomous · No remote allowed' },
      { k: 'Robot size',  v: '20 × 20 cm (height unlimited)' },
      { k: 'Max weight',  v: '1.5 kg' },
      { k: 'Start delay', v: 'Mandatory 5 seconds after signal' },
      { k: 'Required',    v: 'ON/OFF switch · technical inspection (size/weight/delay)' },
      { k: 'Controllers', v: 'Arduino · ESP32 · STM32 · RPi Pico' },
      { k: 'Sensors',     v: 'IR · ultrasonic · ToF · encoders · IMU · cameras' },
      { k: 'Banned',      v: 'Magnets · glue · suction · dangerous combat elements' },
    ],
    arena: [
      { k: 'Ring',           v: '⌀ 770 mm, black matte fanera ≥ 12 mm' },
      { k: 'White border',   v: '2.5 cm Shiro-Tawara edge' },
      { k: 'Shikiri lines',  v: '2 × 8 cm, 20 cm apart, brown' },
      { k: 'Platform',       v: '~50 cm elevated' },
      { k: 'Green zone',     v: '50 cm ring around platform' },
      { k: 'RGB',            v: 'WS2812B around ring (rainbow cycle)' },
      { k: 'Access',         v: '2 staircases, 3 steps × ~17 cm' },
    ],
  },
  {
    id: 'c',
    label: 'MiniRoboWar',
    catLabel: 'Category C',
    type: 'Robot Combat',
    tagline: 'Three fights. Three ways to win. No finals.',
    accent: 'text-rose-600',
    firstBadge: 'First MiniRoboWar event in Uzbekistan',
    unique: [
      {
        title: 'No final stage — every fight counts',
        body: 'Each robot fights 3 separate matches against random opponents. There is no playoff bracket — the podium is decided by accumulated points across all three fights.',
      },
      {
        title: 'Three ways to win',
        body: 'KO — push opponent fully out of arena, fight ends immediately. Immobilization — opponent unable to move for 10 seconds. Judges decision — if neither happens within 2 minutes.',
      },
      {
        title: '5-criteria judge scoring (100 pts)',
        body: 'Aggression (20), Control & maneuverability (20), Technical superiority (20), Structural durability (20), Damage on opponent (20). Used when no KO or immobilization occurs.',
      },
      {
        title: 'Structurally expandable robots',
        body: 'Start size is locked at 20 × 20 × 20 cm, but robots may expand structurally once the fight begins. Weapons, ramps and flippers are allowed up to the 2 kg limit.',
      },
      {
        title: 'Circular arena with polycarbonate walls',
        body: '⌀ 2000 mm battle floor with 1300 mm transparent polycarbonate walls forming a cylinder, on a ~50 cm elevated platform with green zone and 8 cm safety border.',
      },
    ],
    format: [
      'Each team fights 3 separate matches against random opponents.',
      'Points: Win = 3, Draw = 1, Loss = 0. Top-3 by total points → podium.',
      'Tiebreaker: more wins → total judge scores across 3 fights → extra deciding fight.',
      'Match length: 2 minutes. Both stand 15 seconds → draw. Stuck at wall 10 seconds → considered immobilized.',
    ],
    specs: [
      { k: 'Format',      v: 'RC · Manual control only' },
      { k: 'Start size',  v: '20 × 20 × 20 cm (may expand structurally during fight)' },
      { k: 'Max weight',  v: '2 kg (all components)' },
      { k: 'Required',    v: 'Clear ON/OFF switch for emergency stop' },
      { k: 'Match time',  v: '2 minutes maximum' },
      { k: 'Banned',      v: 'Explosives · flammables · liquid systems · radio jammers · open HV' },
    ],
    arena: [
      { k: 'Battle floor',     v: '⌀ 2000 mm circle, MDF/plywood 18 mm grey' },
      { k: 'Safety walls',     v: '1300 mm polycarbonate cylinder, 6–8 mm thickness' },
      { k: 'Platform',         v: '~50 cm elevated, ~3200 × 3200 mm square' },
      { k: 'Green zone',       v: '50 cm border around arena' },
      { k: 'Safety border',    v: '~8 cm rail around platform' },
      { k: 'RGB',              v: 'WS2812B underglow + red flash on KO' },
      { k: 'Access',           v: '2 staircases, 3 steps × ~17 cm' },
    ],
  },
  {
    id: 'd',
    label: 'Robo Football',
    catLabel: 'Category D',
    type: 'Robot Football',
    tagline: 'Stadium with auto-scored goals and real match flow.',
    accent: 'text-emerald-600',
    firstBadge: 'First qualification-based Robo Football tournament in Uzbekistan',
    unique: [
      {
        title: 'First proper qualification tournament in Uzbekistan',
        body: 'Other local events are exhibition demos — two robots from one team playing each other. SFRC runs a full championship between independent teams.',
      },
      {
        title: '2 robots + 2 drivers per team',
        body: 'Each team fields 2 robots controlled by 2 drivers, plus 1 trainer/coach (18+). Drivers may swap controllers between robots during the match. Coaches cannot intervene during play.',
      },
      {
        title: 'IR-beam auto-scoring',
        body: 'When the ball crosses the goal line it falls into a collector under the goal where a TCRT5000 / E18-D80NK IR sensor triggers an ESP32. The score posts to the website over Wi-Fi automatically.',
      },
      {
        title: 'Goal effects: white flash + sound',
        body: 'Each detected goal fires a WS2812B white flash on the platform underglow, a 1000 Hz tone on a PAM8403 speaker, and the score animates on the public display.',
      },
      {
        title: 'Real match flow: 2 halves, ET, penalties',
        body: '2 halves × 2 minutes with a 1-minute break. Tie at full time → 2 minutes of Extra Time with the golden-goal rule. Still tied → penalty shootout.',
      },
    ],
    format: [
      'Pre-match: all robots weighed and measured, placed in quarantine.',
      'Match: 2 halves × 2 minutes, 1-minute break.',
      'Tie at full time → 2 minutes Extra Time (golden goal).',
      'Still tied → Penalty shootout.',
      'No-show: 3 announcements over 2 minutes → team is removed from match.',
    ],
    specs: [
      { k: 'Format',      v: 'RC · 2 robots + 2 drivers + 1 coach per team' },
      { k: 'Robot size',  v: '25 × 25 × 25 cm' },
      { k: 'Max weight',  v: '1.5 kg (all components)' },
      { k: 'Control',     v: 'Any wireless channel · controller off-field' },
      { k: 'Required',    v: 'Clearly visible team affiliation on robots' },
      { k: 'Ball contact', v: 'Less than 50% of ball surface · no full capture' },
      { k: 'Banned',      v: 'Sharp edges · full ball capture · ball-inside-shell designs' },
    ],
    arena: [
      { k: 'Field',         v: '120 × 90 cm green surface, 12 mm plywood base' },
      { k: 'Walls',         v: '30 cm clear acrylic / polycarbonate (4–6 mm)' },
      { k: 'Goals',         v: '56 × 40 cm with net, aluminium frame' },
      { k: 'Ball',          v: 'Foam ⌀ 6–8 cm' },
      { k: 'Platform',      v: '~50 cm elevated, ~130 × 100 cm table' },
      { k: 'Goal sensor',   v: 'IR beam (TCRT5000/E18-D80NK) → ESP32 → Wi-Fi → website' },
      { k: 'Effects',       v: 'WS2812B underglow + white flash + PAM8403 speaker beep' },
      { k: 'Access',        v: '2 staircases, 3 steps × ~17 cm' },
    ],
  },
]

export default function ChallengePage() {
  return (
    <>
    <Header />
    <main className="bg-white min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="text-sm sm:text-base font-bold tracking-[0.15em] text-amber-600 uppercase mb-10 leading-tight">
            The Startup Fest<br />Robotics Challenge
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-[1.15] mb-8 max-w-4xl">
            Four disciplines.<br />
            Four <em className="italic">custom-built</em> arenas.<br />
            One stage.
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl leading-relaxed">
            Every SFRC category is engineered to international standards — built from scratch,
            scored live, judged with formats borrowed from the top robotics circuits in the world.
          </p>
          <nav className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6 text-sm">
            {CATEGORIES.map(c => (
              <a key={c.id} href={`#${c.id}`} className="group flex items-baseline gap-3 hover:text-gray-900 text-gray-500">
                <span className={`font-mono ${c.accent}`}>{c.id.toUpperCase()}</span>
                <span className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors">{c.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── National firsts ──────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            National Firsts
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-12 max-w-3xl">
            SFRC 2026 isn&apos;t a re-run of someone else&apos;s playbook.<br />
            It&apos;s a list of <em className="italic">firsts</em> for Uzbekistan.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">FIRST · 01</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Combat robotics (MiniRoboWar)
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                No public combat robotics event has ever been held in Uzbekistan until SFRC.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">FIRST · 02</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Robo Football Qualification
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                First real tournament — group stage and playoffs, not just exhibition robots from one team.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-600 mb-3">FIRST · 03</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Stadium-grade arena aura
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Elevated platforms, RGB underglow, polycarbonate walls, live scoring — built like a real championship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      {CATEGORIES.map(c => (
        <section key={c.id} id={c.id} className="border-b border-gray-200 scroll-mt-16 sm:scroll-mt-20">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">

            {/* Header */}
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
              <span className={c.accent}>{c.catLabel}</span> · {c.type}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
              {c.label}.<br />
              <span className="text-gray-500 font-medium italic">{c.tagline}</span>
            </h2>
            {c.firstBadge && (
              <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-600 mb-12">
                <span>★</span><span className="uppercase tracking-widest">{c.firstBadge}</span>
              </div>
            )}

            {/* What stands out */}
            <div className="mt-10 mb-14">
              <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6">
                What makes it stand out
              </div>
              <div className="space-y-6">
                {c.unique.map((p, i) => (
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
                Competition format
              </div>
              <ul className="space-y-2 text-base text-gray-700 leading-relaxed max-w-3xl">
                {c.format.map((step, i) => (
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
                  Technical specs
                </div>
                <dl className="space-y-2">
                  {c.specs.map((s, i) => (
                    <div key={i} className="grid grid-cols-3 gap-3 text-sm pb-2 border-b border-gray-100">
                      <dt className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">{s.k}</dt>
                      <dd className="col-span-2 text-gray-800 font-medium">{s.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">
                  Arena
                </div>
                <dl className="space-y-2">
                  {c.arena.map((s, i) => (
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
              <span className="text-xs text-gray-400">Teams competing in this category</span>
              <a href={`/${c.id}`} className="text-sm font-bold text-gray-900 hover:text-amber-600 transition-colors">
                View {c.label} →
              </a>
            </div>
          </div>
        </section>
      ))}

      {/* ── Closing ──────────────────────────────────────────── */}
      <section className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            SFRC 2026 · Tashkent, Uzbekistan
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-[1.15] mb-6 max-w-3xl">
            Built for the next <em className="italic">world finalists</em>.
          </h2>
          <p className="text-base text-gray-500 max-w-3xl leading-relaxed mb-10">
            Want to compete, or learn more about the Robotics and Engineering Association of Uzbekistan?
            Get in touch through our association.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/about" className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-md font-semibold hover:bg-gray-800 transition-colors">
              About the Association →
            </a>
            <a href="/a" className="inline-flex items-center gap-2 text-gray-900 border border-gray-300 px-5 py-2.5 rounded-md font-semibold hover:bg-gray-50 transition-colors">
              Live Results
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <section>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 text-xs text-gray-400">
          Robotics and Engineering Association of Uzbekistan · Tashkent, Uzbekistan · 2026
        </div>
      </section>
    </main>
    </>
  )
}
