'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useEventSettings } from '@/lib/use-event-settings'
import TrophyCard, { TrophyCrest, teamCode } from './TrophyCard'
import type { LiveStateB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import FinalsBracketB from '@/components/public/FinalsBracketB'
import { ConfettiRain, GrandFinalAura } from './VictoryScreen'

interface TeamLite {
  id: string
  name: string | null
  school: string | null
}

interface FinalsMatchB {
  match_id: string
  status: string
  red: TeamLite | null
  white: TeamLite | null
  winner: 0 | 1 | 2 | null
  rounds1: number | null
  rounds2: number | null
}

interface FieldState {
  state: LiveStateB
  match: ScheduledMatch | null
  red: TeamLite | null
  white: TeamLite | null
  finalsData?: FinalsMatchB[] | null
}

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COUNTDOWN_SECONDS = 5
const GO_OVERLAY_MS = 1000      // "START!" / "GO!" shown for 1 second after countdown
const ROUND_OVERLAY_MS = 2500   // Yuhkoh-by-X stays a bit longer (informative)
const WINNER_OVERLAY_MS = 4500  // big WINNER overlay before fading to side badge

// Countdown rebased to the moment this effect fires (= moment client sees phase=countdown).
// Fresh anchor every time so a brand-new match always starts from 5.
function useCountdown(startedAt: string | null, phase: LiveStateB['phase']) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (phase !== 'countdown' || !startedAt) { setRemaining(null); return }
    const localStart = Date.now()
    setRemaining(COUNTDOWN_SECONDS)
    const tick = () => {
      const r = COUNTDOWN_SECONDS - (Date.now() - localStart) / 1000
      setRemaining(r > 0 ? r : 0)
    }
    const id = setInterval(tick, 60)
    return () => clearInterval(id)
  }, [startedAt, phase])

  return remaining
}

// Count-up match timer (mm:ss). Anchored on the moment THIS CLIENT sees phase=fighting,
// so it always starts from 00:00 without depending on server↔client clock alignment.
function useMatchTimer(phase: LiveStateB['phase']) {
  const [text, setText] = useState('00:00')
  useEffect(() => {
    if (phase !== 'fighting') { setText('00:00'); return }
    const start = Date.now()
    setText('00:00')
    const tick = () => {
      const ms = Date.now() - start
      const totalSec = Math.floor(ms / 1000)
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
      const ss = String(totalSec % 60).padStart(2, '0')
      setText(`${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [phase])
  return text
}

// Time (ms) since last phase change. Used to auto-fade overlays after ~2.5s.
function usePhaseElapsed(phase: LiveStateB['phase']) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - start), 100)
    return () => clearInterval(id)
  }, [phase])
  return elapsed
}

export default function FieldBClient() {
  const [data, setData] = useState<FieldState | null>(null)
  const lastFetchAt = useRef(Date.now())
  const [stale, setStale] = useState(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/field/b/state', { cache: 'no-store' })
      if (res.ok) {
        setData(await res.json())
        lastFetchAt.current = Date.now()
        setStale(false)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const id = setInterval(() => setStale(Date.now() - lastFetchAt.current > 8000), 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Refetch immediately when tab becomes visible (e.g. judge switches Finals ON on another device)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  useEffect(() => {
    const id = setInterval(refetch, hasSupabase ? 4000 : 300)
    return () => clearInterval(id)
  }, [refetch])

  useEffect(() => {
    if (!hasSupabase) return
    let cancelled = false
    let channel: ReturnType<import('@supabase/supabase-js').SupabaseClient['channel']> | undefined
    let supabaseRef: import('@supabase/supabase-js').SupabaseClient | undefined
    async function subscribe() {
      const { createBrowserClient } = await import('@supabase/ssr')
      if (cancelled) return
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      supabaseRef = supabase
      channel = supabase.channel(`field-b-${Date.now()}`)
      for (const table of ['live_match_state', 'scheduled_matches', 'teams', 'matches_b']) {
        channel.on('postgres_changes' as never, { event: '*', schema: 'public', table }, () => refetch())
      }
      channel.subscribe()
    }
    subscribe()
    return () => {
      cancelled = true
      if (channel && supabaseRef) supabaseRef.removeChannel(channel)
    }
  }, [refetch])

  if (!data) return <Splash label="Mini Sumo" />
  return (
    <>
      <Scoreboard data={data} />
      {data.state.finals_visible && data.finalsData && data.finalsData.length > 0 && (
        <FinalsOverlayB items={data.finalsData} />
      )}
      {data.state.standby_mode && <StandbyOverlay />}
      {stale && <ReconnectingBanner />}
    </>
  )
}

function StandbyOverlay() {
  const { watermark, settings } = useEventSettings('en')
  const eventName = settings.event_name ?? 'Startup Fest Robotics Challenge'
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white select-none"
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #14141c 100%)' }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div aria-hidden className="absolute inset-y-0 -left-1/4 w-1/2 pointer-events-none"
        style={{
          background: 'linear-gradient(110deg, transparent 0%, rgba(245,158,11,0.06) 50%, transparent 100%)',
          animation: 'sfrcSheen 12s linear infinite',
        }}
      />
      <div className="relative z-10 text-center px-8 flex flex-col items-center">
        {/* Event name */}
        <div
          className="font-black tracking-[0.3em] uppercase text-amber-400/70 mb-2"
          style={{ fontSize: 'clamp(1.4rem, 3.5vw, 3rem)' }}
        >
          {eventName}
        </div>
        {/* City + year */}
        <div
          className="font-mono text-white/40 mb-8"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)', letterSpacing: '0.3em' }}
        >
          {watermark}
        </div>

        {/* Category */}
        <div
          className="font-black tracking-[0.35em] uppercase text-amber-400/90 mb-3"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
        >
          Mini Sumo
        </div>
        <div className="w-48 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent mb-8 mx-auto" />

        {/* BREAK */}
        <div
          className="font-black tracking-tight mb-5"
          style={{ fontSize: 'clamp(5rem, 18vw, 14rem)', lineHeight: 0.9, animation: 'sfrcGlow 3s ease-in-out infinite' }}
        >
          BREAK
        </div>
        <div className="text-white/40 tracking-[0.4em] uppercase" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)' }}>
          Please wait…
        </div>
      </div>
    </div>
  )
}

function ReconnectingBanner() {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 border border-amber-500/50 text-amber-400 text-xs font-mono tracking-wider">
      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
      RECONNECTING…
    </div>
  )
}

function Splash({ label }: { label: string }) {
  return (
    <div className="h-screen flex items-center justify-center text-white/30 text-2xl tracking-widest uppercase">
      {label} ·  loading…
    </div>
  )
}

function Scoreboard({ data }: { data: FieldState }) {
  const { settings: eventSettings, cityName: eventCity, watermark: eventWatermark } = useEventSettings('en')
  const { state, match, red, white } = data
  const remaining = useCountdown(state.countdown_started_at, state.phase)
  const matchTimer = useMatchTimer(state.phase)
  const phaseElapsed = usePhaseElapsed(state.phase)
  const total = state.round_number > 3 ? state.round_number : 3
  const hasMatch = state.phase !== 'idle' && match && red && white
  const isFinal = state.phase === 'match_result'
  const winnerSide: 'red' | 'white' | 'draw' | null =
    state.match_winner === 1 ? 'red'
    : state.match_winner === 2 ? 'white'
    : state.match_winner === 0 ? 'draw'
    : null

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col text-white select-none relative"
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #14141c 100%)' }}>

      {/* ── Decorative background: hex dot pattern + slow sheen ───────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 -left-1/4 w-1/2 pointer-events-none"
        style={{
          background: 'linear-gradient(110deg, transparent 0%, rgba(245,158,11,0.06) 50%, transparent 100%)',
          animation: 'sfrcSheen 12s linear infinite',
        }}
      />

      {/* ── Top bar ── */}
      <header className="relative z-20 shrink-0 px-6 sm:px-10 py-3 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-white/80">
            Match Results
          </div>
          {hasMatch && (state.phase === 'fighting' || state.phase === 'countdown' || state.phase === 'waiting' || state.phase === 'positioning') && (
            <div className="hidden sm:flex items-center gap-1.5 bg-red-600/90 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full" style={{ animation: 'sfrcLive 1.1s ease-in-out infinite' }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-white">Match Live</span>
            </div>
          )}
        </div>
        <div className="text-center">
          {hasMatch && (
            <>
              <div className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-white/40 uppercase">
                {state.round_number > 3 ? 'Golden Match' : `Round ${state.round_number} of ${total}`}
              </div>
              <div className="font-black text-base sm:text-lg tracking-tight flex items-baseline gap-3 justify-center">
                <span>Match {match!.match_id}</span>
                {state.phase === 'fighting' && (
                  <span className="font-mono tabular-nums text-amber-400 text-lg sm:text-2xl">{matchTimer}</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-black tracking-[0.3em] uppercase">
          🤼 Mini Sumo
        </div>
      </header>

      {/* ── Idle ── */}
      {!hasMatch && (
        <section className="relative flex-1 flex flex-col items-center justify-center text-center px-8 z-10">
          <div className="text-amber-400/70 text-xs font-black tracking-[0.4em] uppercase mb-4">Mini Sumo</div>
          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent mb-6" />
          <div className="text-5xl sm:text-7xl font-black tracking-tight mb-3" style={{ animation: 'sfrcGlow 3s ease-in-out infinite' }}>
            No active match
          </div>
          <div className="text-white/40 text-lg">Waiting for judge to start the next match</div>
        </section>
      )}

      {hasMatch && (
        <main className="flex-1 min-h-0 relative">
          {/* Diagonal split background (FTC-style) */}
          <div className="absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-1/2"
              style={{
                background: 'linear-gradient(110deg, #b91c1c 0%, #7f1d1d 60%, #450a0a 100%)',
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 4vw) 100%, 0 100%)',
              }}
            />
            <div className="absolute inset-y-0 right-0 w-1/2"
              style={{
                background: 'linear-gradient(70deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%)',
                clipPath: 'polygon(4vw 0, 100% 0, 100% 100%, 0 100%)',
              }}
            />
          </div>

          {/* Content */}
          <div className="relative h-full grid grid-cols-2 z-10">
            {/* Red side */}
            <SideColumn
              side="red"
              team={red!}
              wins={state.wins_red}
              fouls={state.fouls_red}
              dimmed={isFinal && winnerSide === 'white'}
              winnerBadge={isFinal && winnerSide === 'red'}
              fighting={state.phase === 'fighting'}
            />

            {/* Blue side */}
            <SideColumn
              side="white"
              team={white!}
              wins={state.wins_white}
              fouls={state.fouls_white}
              dimmed={isFinal && winnerSide === 'red'}
              winnerBadge={isFinal && winnerSide === 'white'}
              fighting={state.phase === 'fighting'}
            />

            {/* Middle breakdown panel (FTC-style score breakdown) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[44%] max-w-2xl">
              <BreakdownTable state={state} />
            </div>

            {/* Center stage overlay (countdown / fight / yuhkoh / draw badge) */}
            <CenterOverlay state={state} remaining={remaining} winnerSide={winnerSide} phaseElapsed={phaseElapsed} matchTimer={matchTimer} redTeam={red} whiteTeam={white} />

            {/* Branded trophy card — settles in after the 4.5s sparkle slam. The
                slam shows the side ("RED"); this shows the actual team name +
                serial + watermark, the photo-worthy final composition. */}
            {isFinal && winnerSide && winnerSide !== 'draw' && phaseElapsed >= WINNER_OVERLAY_MS && (
              <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm flex items-center justify-center">
                <TrophyCard
                  accent={winnerSide === 'red' ? 'red' : 'blue'}
                  serial={match!.match_id}
                  watermark={eventWatermark}
                  caption="Mini Sumo · SFRC"
                  label="WINNER"
                  winnerName={(winnerSide === 'red' ? red! : white!).name ?? '—'}
                >
                  <TrophyCrest accent="red" code={teamCode(red!.name)} />
                  <div className="font-black tabular-nums text-white leading-none" style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.04em' }}>
                    {state.wins_red} <span className="text-white/40">—</span> {state.wins_white}
                  </div>
                  <TrophyCrest accent="blue" code={teamCode(white!.name)} />
                </TrophyCard>
              </div>
            )}

            {/* Confetti + aura — Grand Final only */}
            {match?.match_id === 'FB-F1' && winnerSide && winnerSide !== 'draw' && phaseElapsed >= WINNER_OVERLAY_MS && (
              <>
                <ConfettiRain />
                <GrandFinalAura />
              </>
            )}
          </div>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="shrink-0 overflow-hidden border-t border-white/10 bg-black/50 h-9 flex items-center">
        <div
          className="flex whitespace-nowrap text-[11px] tracking-[0.28em] font-bold uppercase text-amber-400/50"
          style={{ animation: 'sfrcMarquee 55s linear infinite' }}
        >
          {[0, 1].map(i => (
            <span key={i}>{`ASSOCIATION OF ROBOTICS AND ENGINEERING OF UZBEKISTAN · STARTUP FEST ROBOTICS CHALLENGE · ${eventSettings.year} · MINI SUMO · `.repeat(4)}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}

function SideColumn({
  side, team, wins, fouls, dimmed, winnerBadge, fighting,
}: {
  side: 'red' | 'white'
  team: TeamLite
  wins: number
  fouls: number
  dimmed: boolean
  winnerBadge: boolean
  fighting: boolean
}) {
  const isRed = side === 'red'
  // Both sides now have white text (red side on red bg, blue side on blue bg)
  const textPrimary = 'text-white'
  const textMuted = isRed ? 'text-white/60' : 'text-blue-100/80'
  const sideLabel = isRed ? 'Red' : 'Blue'

  // Re-mount the number on wins change so the flip animation re-plays.
  const [flipKey, setFlipKey] = useState(0)
  useEffect(() => { setFlipKey((k) => k + 1) }, [wins])

  return (
    <div
      className={`relative h-full px-6 sm:px-12 py-6 sm:py-10 flex flex-col ${dimmed ? 'opacity-40' : 'opacity-100'} transition-opacity duration-500`}
      style={fighting ? { animation: isRed ? 'sfrcSidePulseRed 1.6s ease-in-out infinite' : 'sfrcSidePulseWhite 1.6s ease-in-out infinite' } : undefined}
    >
      {/* Side label */}
      <div className={`flex items-center gap-2 ${isRed ? '' : 'justify-end'}`}>
        <span className="text-2xl">{isRed ? '🔴' : '🔵'}</span>
        <span className={`text-xs sm:text-sm font-black tracking-[0.3em] uppercase ${isRed ? 'text-white/70' : 'text-blue-100/80'}`}>
          {sideLabel}
        </span>
      </div>

      {/* Big wins counter */}
      <div className={`flex-1 flex flex-col ${isRed ? 'items-start' : 'items-end'} justify-center -mt-12`}>
        <div
          key={flipKey}
          className={`font-black tabular-nums leading-none ${textPrimary}`}
          style={{ fontSize: 'clamp(7rem, 22vw, 22rem)', lineHeight: 0.85, animation: 'sfrcCountFlip 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {wins}
        </div>
        <div className={`text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mt-2 ${textMuted}`}>
          Round Wins
        </div>
        {fouls > 0 && (
          <div className="mt-3 text-xs font-bold tracking-widest text-amber-300">
            {fouls} FOULS
          </div>
        )}
      </div>

      {/* Team name + school at bottom */}
      <div className={`shrink-0 ${isRed ? 'text-left' : 'text-right'}`}>
        <div className={`font-black text-2xl sm:text-4xl leading-tight truncate ${textPrimary}`}>
          {team.name ?? '—'}
        </div>
        {team.school && (
          <div className={`text-sm sm:text-base mt-1 truncate ${textMuted}`}>
            {team.school}
          </div>
        )}
      </div>

      {/* Winner badge corner */}
      {winnerBadge && (
        <div className={`absolute top-6 ${isRed ? 'right-6' : 'left-6'} z-30 flex items-center gap-2 bg-amber-400 text-gray-900 px-3 py-1.5 rounded shadow-2xl`}>
          <span className="text-base">🏆</span>
          <span className="text-xs font-black tracking-[0.25em] uppercase">WINNER</span>
        </div>
      )}
    </div>
  )
}

function BreakdownTable({ state }: { state: LiveStateB }) {
  const positionLabel = state.starting_position
    ? state.starting_position === 'face' ? 'Face-to-Face'
      : state.starting_position === 'side' ? 'Side-by-Side'
      : 'Back-to-Back'
    : '—'

  type Row = { label: string; red: React.ReactNode; white: React.ReactNode; center: React.ReactNode | null }
  const rows: Row[] = [
    { label: 'POSITION', red: positionShort(state.starting_position), white: positionShort(state.starting_position), center: positionLabel },
    { label: 'FOULS',    red: state.fouls_red,                       white: state.fouls_white,                       center: null },
    { label: 'HISTORY',  red: historyCount(state.round_history, 'red'), white: historyCount(state.round_history, 'white'), center: historyDots(state.round_history) },
  ]

  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-md border border-white/10 shadow-2xl overflow-hidden">
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-[1fr_2fr_1fr] items-center px-4 sm:px-5 py-2.5 ${i > 0 ? 'border-t border-white/10' : ''}`}>
          <div className="text-base sm:text-2xl font-black text-white tabular-nums text-right">{r.red}</div>
          <div className="text-[9px] sm:text-[11px] font-black tracking-[0.25em] text-white/50 uppercase text-center">
            <div>{r.center ?? r.label}</div>
            {r.center && <div className="text-[8px] tracking-widest text-white/30 mt-0.5">{r.label}</div>}
          </div>
          <div className="text-base sm:text-2xl font-black text-white tabular-nums">{r.white}</div>
        </div>
      ))}
    </div>
  )
}

function positionShort(pos: LiveStateB['starting_position']): string {
  if (!pos) return '—'
  return pos === 'face' ? '◆' : pos === 'side' ? '↔' : '↻'
}

function historyCount(hist: ('red' | 'white' | 'draw')[], side: 'red' | 'white') {
  return hist.filter(h => h === side).length
}

function historyDots(hist: ('red' | 'white' | 'draw')[]): React.ReactNode {
  if (hist.length === 0) return '—'
  return (
    <div className="flex justify-center gap-1">
      {hist.map((h, i) => (
        <span key={i} className={`inline-block w-2 h-2 rounded-full ${h === 'red' ? 'bg-red-500' : h === 'white' ? 'bg-blue-500' : 'bg-amber-400'}`} />
      ))}
    </div>
  )
}

function CenterOverlay({
  state, remaining, winnerSide, phaseElapsed, matchTimer, redTeam, whiteTeam,
}: {
  state: LiveStateB
  remaining: number | null
  winnerSide: 'red' | 'white' | 'draw' | null
  phaseElapsed: number
  matchTimer: string
  redTeam: TeamLite | null
  whiteTeam: TeamLite | null
}) {
  // Countdown always shown in full while we're in countdown phase.
  if (state.phase === 'countdown' && remaining !== null) {
    const isGo = remaining <= 0.2
    const big = isGo ? 'GO!' : Math.ceil(remaining).toString()
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="bg-black/85 backdrop-blur-md rounded-3xl px-12 py-8 border-2 border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.4)]">
          <div className="text-amber-400 text-xs font-black tracking-[0.4em] uppercase text-center mb-2">Get ready</div>
          <div className={`font-black tabular-nums leading-none text-center ${isGo ? 'text-amber-400' : 'text-white'}`} style={{ fontSize: 'clamp(7rem, 18vw, 16rem)' }}>
            {big}
          </div>
        </div>
      </div>
    )
  }

  // Brief "GO! / START!" pop only for the first 1s of fighting — then just the match timer.
  if (state.phase === 'fighting') {
    if (phaseElapsed < GO_OVERLAY_MS) {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="font-black text-amber-400 tracking-tight animate-[sfrcStart_0.4s_ease-out] drop-shadow-[0_0_40px_rgba(245,158,11,0.8)]" style={{ fontSize: 'clamp(6rem, 16vw, 14rem)' }}>
            GO!
          </div>
        </div>
      )
    }
    // After START! fades — show running match timer at center top.
    return (
      <div className="absolute inset-x-0 top-4 sm:top-8 z-30 flex items-start justify-center pointer-events-none">
        <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-2 border border-amber-400/40 shadow-xl">
          <div className="font-mono font-black tabular-nums text-amber-400 leading-none" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
            {matchTimer}
          </div>
        </div>
      </div>
    )
  }

  // Round result overlay — shown 2.5s.
  if (state.phase === 'round_result' && phaseElapsed < ROUND_OVERLAY_MS) {
    const w = state.last_round_winner
    if (w === 'draw') {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-black/85 rounded-2xl px-10 py-6 border-2 border-amber-400 animate-[sfrcStart_0.35s_ease-out] text-center">
            <div className="text-white/50 text-xs font-black tracking-[0.4em] uppercase mb-2">Round {state.round_number}</div>
            <div className="font-black text-amber-400 text-5xl sm:text-7xl">Draw</div>
          </div>
        </div>
      )
    }
    const teamName = w === 'red' ? (redTeam?.name ?? 'Red') : (whiteTeam?.name ?? 'Blue')
    const color = w === 'red' ? 'text-red-400' : 'text-blue-300'
    const borderColor = w === 'red' ? 'border-red-500' : 'border-blue-400'
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className={`bg-black/85 backdrop-blur-md rounded-2xl px-12 py-7 border-2 ${borderColor} animate-[sfrcStart_0.35s_ease-out] text-center`}>
          <div className="text-white/50 text-xs font-black tracking-[0.4em] uppercase mb-2">Round {state.round_number}</div>
          <div className={`font-black leading-tight ${color}`} style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)' }}>
            {teamName}
          </div>
          <div className="text-white/60 text-sm font-black tracking-[0.35em] uppercase mt-2">Wins the round</div>
        </div>
      </div>
    )
  }

  // ── HUGE WINNER overlay — first 4.5s of match_result, with entry + glow. Then fades to side badge. ──
  if (state.phase === 'match_result' && phaseElapsed < WINNER_OVERLAY_MS) {
    if (winnerSide === 'draw') {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-black/85 rounded-3xl px-14 py-10 border-2 border-amber-400 animate-[sfrcStart_0.5s_ease-out]">
            <div className="font-black text-amber-400 text-5xl sm:text-7xl text-center">🟰 Match Drawn</div>
          </div>
        </div>
      )
    }
    const winColor = winnerSide === 'red' ? 'text-red-400' : 'text-blue-300'
    const winTeamName = winnerSide === 'red' ? (redTeam?.name ?? 'Red') : (whiteTeam?.name ?? 'Blue')
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="relative animate-[sfrcWinner_0.7s_ease-out]">
          <div className="absolute inset-0 rounded-3xl bg-amber-400/20 blur-3xl animate-[sfrcGlow_1.6s_ease-in-out_infinite] -z-10" />
          <Sparkles />
          <div className="bg-black/90 backdrop-blur-md rounded-3xl px-16 py-12 border-4 border-amber-400 shadow-[0_0_120px_rgba(245,158,11,0.6)] text-center">
            <div className="flex items-center justify-center gap-4 text-amber-400 text-xl sm:text-2xl font-black tracking-[0.35em] uppercase mb-3">
              <span className="text-3xl sm:text-4xl">🏆</span>
              WINNER
            </div>
            <div className={`font-black tracking-tight ${winColor} leading-none`} style={{ fontSize: 'clamp(3rem, 9vw, 7rem)' }}>
              {winTeamName}
            </div>
            <div className="text-white/70 text-base sm:text-xl font-bold tracking-widest uppercase mt-3">
              {state.wins_red} − {state.wins_white}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function finalsRoundOf(matchId: string) {
  if (matchId.startsWith('FB-QF')) return 'quarter'
  if (matchId.startsWith('FB-SF')) return 'semi'
  if (matchId === 'FB-3RD') return 'third_place'
  if (matchId === 'FB-F1') return 'final'
  if (matchId.startsWith('FB-R1')) return 'r1'
  if (matchId.startsWith('FB-R2')) return 'r2'
  if (matchId.startsWith('FB-T')) return 'triangle'
  return null
}

function stakesBadges(round: string | null): { win: string; lose?: string } {
  switch (round) {
    case 'semi':
    case 'r2':      return { win: '🥇 играет за 1-е место', lose: '🥉 играет за 3-е место' }
    case 'quarter':
    case 'r1':      return { win: '→ Semi-Final' }
    case 'final':   return { win: '🥇 Финал — 1-е место' }
    case 'third_place': return { win: '🥉 Матч за 3-е место' }
    case 'triangle': return { win: '🔺 Triangle Final' }
    default:        return { win: '→ следующий раунд' }
  }
}

// ── Finals bracket overlay (shown when judge enables Finals) ──
//
// Scale math: bracket totalH = 632*scale + 4 (tallest path = 6 R1 cards).
// We measure the actual container height after layout (via ref) and solve:
//   scale = (containerH - 4) / 632, clamped to [0.4, 1.5].
// colGapMult stretches columns to fill available width.
function FinalsOverlayB({ items }: { items: FinalsMatchB[] }) {
  const next = items.find(m => m.status === 'pending' && m.red && m.white)
  const round = next ? finalsRoundOf(next.match_id) : null
  const stakes = stakesBadges(round)

  // null = scale not yet computed (bracket hidden to avoid layout flash)
  const [bracketScale, setBracketScale] = useState<number | null>(null)
  const [colGapMult, setColGapMult] = useState(3)
  const bracketAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fit() {
      const area = bracketAreaRef.current
      if (!area) return
      // clientHeight is the ACTUAL rendered height of the flex-1 bracket area
      // after all other shrink-0 elements have taken their space.
      const availH = area.clientHeight - 8  // subtract py-1 (4px × 2)
      const availW = area.clientWidth - 80  // subtract px-10 (40px × 2)

      const s = Math.min(Math.max((availH - 4) / 632, 0.4), 1.5)

      const cardW = Math.round(180 * s)
      const colGapBase = Math.round(64 * s)
      const c = Math.max(1, Math.min((Math.max(availW, 300) - 3 * cardW) / (2 * colGapBase), 6))

      setBracketScale(s)
      setColGapMult(c)
    }

    // First fit runs after the flex layout has settled
    fit()

    const ro = new ResizeObserver(fit)
    if (bracketAreaRef.current) ro.observe(bracketAreaRef.current)
    return () => ro.disconnect()
  }, [items])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #080810 0%, #0e0e1a 50%, #060608 100%)' }}
    >
      {/* Dot grid bg */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
          backgroundSize: '28px 28px', opacity: 0.04,
        }}
      />
      {/* Amber glow top */}
      <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)' }}
      />

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-4 pb-2 px-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-amber-400/60" />
          <span className="text-amber-400/70 text-[11px] font-black tracking-[0.4em] uppercase">
            {items.some(m => finalsRoundOf(m.match_id) === 'triangle') ? 'Round Robin · Triangle Final' : 'Single Elimination · Best of 3'}
          </span>
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-amber-400/60" />
        </div>
        <h1 className="text-amber-400 font-black tracking-[0.3em] uppercase"
          style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)', textShadow: '0 0 40px rgba(245,158,11,0.5)' }}>
          🏆 MINI SUMO — FINALS
        </h1>
      </div>

      {/* ── Bracket — hidden until scale computed, then snaps in ── */}
      <div
        ref={bracketAreaRef}
        className="relative z-10 flex-1 min-h-0 flex items-center justify-center overflow-hidden px-10 py-1"
        style={{ visibility: bracketScale === null ? 'hidden' : 'visible' }}
      >
        <FinalsBracketB matches={items} dark scale={bracketScale ?? 1.0} colGapMult={colGapMult} />
      </div>

      {/* ── Next match callout ── */}
      {next && (
        <div className="relative z-10 shrink-0 flex justify-center px-8 pb-4">
          <div className="w-full max-w-2xl rounded-xl overflow-hidden"
            style={{ border: '1.5px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', backdropFilter: 'blur(8px)' }}>
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
            <div className="px-8 py-3 text-center">
              <div className="text-white/40 text-[10px] font-black tracking-[0.4em] uppercase mb-1.5">
                Следующий матч · {next.match_id}
              </div>
              <div className="font-black text-white mb-2"
                style={{ fontSize: 'clamp(1.3rem, 3vw, 2.2rem)', letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                {next.red?.name ?? 'TBD'}
                <span className="text-white/25 mx-3 font-light">vs</span>
                {next.white?.name ?? 'TBD'}
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 rounded-full px-4 py-1.5"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)' }}>
                  <span className="text-green-400 text-xs font-black tracking-[0.25em] uppercase">WIN →</span>
                  <span className="text-green-300 text-xs font-bold tracking-wider uppercase">{stakes.win}</span>
                </div>
                {stakes.lose && (
                  <div className="flex items-center gap-2 rounded-full px-4 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span className="text-white/40 text-xs font-black tracking-[0.25em] uppercase">LOSE →</span>
                    <span className="text-white/50 text-xs font-bold tracking-wider uppercase">{stakes.lose}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer watermark */}
      <div className="relative z-10 shrink-0 pb-2 text-center text-white/15 text-[10px] tracking-[0.5em] uppercase font-mono">
        SFRC · STARTUP FEST ROBOTICS CHALLENGE
      </div>
    </div>
  )
}

// ── Confetti-style sparkles around the WINNER box. Each star flies outward
// in a distinct direction (sfrcSparkleA..F keyframes) on a loop with stagger.
function Sparkles() {
  const STARS = [
    { anim: 'sfrcSparkleA', delay: '0s',   color: 'text-amber-300' },
    { anim: 'sfrcSparkleB', delay: '0.3s', color: 'text-amber-400' },
    { anim: 'sfrcSparkleC', delay: '0.55s',color: 'text-yellow-200' },
    { anim: 'sfrcSparkleD', delay: '0.8s', color: 'text-amber-300' },
    { anim: 'sfrcSparkleE', delay: '1.0s', color: 'text-yellow-300' },
    { anim: 'sfrcSparkleF', delay: '1.2s', color: 'text-amber-200' },
    { anim: 'sfrcSparkleA', delay: '1.5s', color: 'text-amber-400' },
    { anim: 'sfrcSparkleC', delay: '1.8s', color: 'text-yellow-200' },
    { anim: 'sfrcSparkleE', delay: '2.1s', color: 'text-amber-300' },
  ]
  return (
    <>
      {STARS.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className={`absolute left-1/2 top-1/2 text-2xl ${s.color} drop-shadow-[0_0_12px_rgba(245,158,11,0.9)] pointer-events-none`}
          style={{ animation: `${s.anim} 2.6s ease-out ${s.delay} infinite`, opacity: 0 }}
        >
          ✦
        </span>
      ))}
    </>
  )
}
