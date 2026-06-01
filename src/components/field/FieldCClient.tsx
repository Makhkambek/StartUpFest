'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useEventSettings } from '@/lib/use-event-settings'
import TrophyCard, { TrophyCrest, teamCode } from './TrophyCard'
import type { LiveStateB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import FinalsBracketB from '@/components/public/FinalsBracketB'

interface TeamLite {
  id: string
  name: string | null
  school: string | null
}

interface NextMatch {
  match_id: string
  status: ScheduledMatch['status']
  red: TeamLite | null
  white: TeamLite | null
}

interface BracketMatchC {
  match_id: string
  status: string
  red: TeamLite | null
  white: TeamLite | null
  winner: 1 | 2 | 0 | null
  rounds1: number | null
  rounds2: number | null
}

interface FieldStateC {
  state: LiveStateB
  match: ScheduledMatch | null
  red: TeamLite | null
  white: TeamLite | null
  nextMatch: NextMatch | null
  finalsData?: BracketMatchC[] | null
}

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COUNTDOWN_SECONDS = 5
const MATCH_DURATION_SEC = 120
const RESULT_SUSPENSE_MS = 2200      // FTC-style "calculating result" build-up
const RESULT_HOLD_MS = 5500           // total time we stay on result screen (incl. suspense)

// Countdown 5..4..3..2..1. Local rebase to the moment this client observed phase=countdown
// (handles latency, server↔client clock drift, polling delay). On each entry to the
// countdown phase the anchor is reset from scratch, so a new match always starts from 5.
function useCountdown(startedAt: string | null, phase: LiveStateB['phase']) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (phase !== 'countdown' || !startedAt) { setRemaining(null); return }
    // Fresh anchor every time this effect re-fires (which happens when either phase or
    // startedAt changes). Always starts visibly at 5.
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

// 2-minute REVERSE timer. Triggered by `active` flag — judge clicks Start → countdown
// finishes → `active` becomes true → timer starts from 120 immediately, no waiting for
// server phase flip. Keeps last value when active flips off (visual freeze on bout end).
function useReverseTimer(active: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(MATCH_DURATION_SEC)
  useEffect(() => {
    if (!active) return  // freeze last value
    const start = Date.now()
    setSecondsLeft(MATCH_DURATION_SEC)
    const tick = () => {
      const r = MATCH_DURATION_SEC - (Date.now() - start) / 1000
      setSecondsLeft(r > 0 ? r : 0)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [active])
  return secondsLeft
}

function usePhaseElapsed(phase: LiveStateB['phase']) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - start), 80)
    return () => clearInterval(id)
  }, [phase])
  return elapsed
}

function formatMMSS(s: number): string {
  const mm = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function FieldCClient() {
  const [data, setData] = useState<FieldStateC | null>(null)
  const lastFetchAt = useRef(Date.now())
  const [stale, setStale] = useState(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/field/c/state', { cache: 'no-store' })
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
      channel = supabase.channel(`field-c-${Date.now()}`)
      for (const table of ['live_match_state', 'scheduled_matches', 'teams', 'fights_c']) {
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

  if (!data) return <Boot label={'MiniRoboWar'} />
  return (
    <>
      <FightingView data={data} />
      {data.state.finals_visible && data.finalsData && data.finalsData.length > 0 && (
        <FinalsBracketOverlayC matches={data.finalsData} />
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white overflow-hidden select-none"
      style={{ fontFamily: '"Anton", "Impact", "Arial Black", sans-serif' }}
    >
      <SparkLayer />
      <div className="relative z-10 text-center px-8 flex flex-col items-center">
        {/* Event name */}
        <div
          className="font-black tracking-[0.3em] uppercase text-rose-300/70 mb-2"
          style={{ fontSize: 'clamp(1.4rem, 3.5vw, 3rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}
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
          className="text-rose-300 font-black tracking-[0.45em] uppercase mb-3"
          style={{
            fontSize: 'clamp(2.5rem, 7vw, 6rem)',
            animation: 'sfrcMagentaPulse 3s ease-in-out infinite',
          }}
        >
          MiniRoboWar
        </div>
        <div className="w-48 h-[2px] bg-gradient-to-r from-transparent via-rose-400/60 to-transparent mb-8 mx-auto" />

        {/* BREAK */}
        <div
          className="text-rose-200 font-black uppercase tracking-tight text-center mb-5"
          style={{ fontSize: 'clamp(5rem, 18vw, 14rem)', lineHeight: 0.9 }}
        >
          BREAK
        </div>
        <div className="text-white/40 uppercase tracking-[0.4em] text-center" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)' }}>
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

function Boot({ label }: { label: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-black text-rose-500 text-2xl tracking-widest font-black">
      ▶ {label} ▶ LOADING
    </div>
  )
}

function FightingView({ data }: { data: FieldStateC }) {
  const { settings: eventSettings, watermark: eventWatermark } = useEventSettings('en')
  const { state, match, red, white, nextMatch } = data

  const isRunning = state.phase === 'fighting'
  const isCountdown = state.phase === 'countdown'
  const isFinished = state.phase === 'round_result'
  const isMatchOver = state.phase === 'match_result'
  const hasMatch = state.phase !== 'idle' && match && red && white

  // During first ~2.2s of round_result/match_result — show "calculating" suspense.
  // After that — actual reveal (winner + score bars unlock).
  const isResultPhase = isFinished || isMatchOver

  const cdRemaining = useCountdown(state.countdown_started_at, state.phase)
  // Timer becomes "active" the instant the visible countdown reaches 0, OR when phase is
  // already 'fighting' (judge pressed GO without countdown). Decouples timer start from
  // server phase flip — no latency-related "stuck on 02:00".
  const countdownFinished = isCountdown && cdRemaining !== null && cdRemaining <= 0
  const timerActive = isRunning || countdownFinished
  const matchSeconds = useReverseTimer(timerActive)
  const phaseElapsed = usePhaseElapsed(state.phase)
  const suspenseDone = isResultPhase && phaseElapsed >= RESULT_SUSPENSE_MS
  const inSuspense = isResultPhase && !suspenseDone

  // Idle / next preview state
  if (!hasMatch) {
    return <ArenaIdle next={nextMatch} />
  }

  // Final method (KO / IMM / JD) read from starting_position hack at end.
  const method =
    isFinished || isMatchOver
      ? state.starting_position === 'face' ? 'KO'
      : state.starting_position === 'side' ? 'IMM'
      : state.starting_position === 'back' ? 'JD'
      : null
      : null

  const winnerSide: 'red' | 'white' | 'draw' | null =
    state.match_winner === 1 ? 'red'
    : state.match_winner === 2 ? 'white'
    : state.match_winner === 0 ? 'draw'
    : null

  // Shake on KO entry
  const shouldShake = (isFinished || isMatchOver) && method === 'KO' && phaseElapsed < 700

  // Timer color critical
  const timerCritical = matchSeconds <= 30 && isRunning

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col text-white select-none relative"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #2a0508 0%, #0a0306 65%, #02010a 100%)',
        animation: shouldShake ? 'sfrcScreenShake 0.7s ease-out' : undefined,
        fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
      }}
    >
      {/* Sparks bg */}
      <SparkLayer />

      {/* ── TOP HEALTH BARS ── */}
      <header className="relative z-20 grid grid-cols-2 gap-3 px-6 sm:px-10 pt-4 pb-3 border-b-2 border-rose-700/50">
        <HealthBar
          side="red"
          name={red!.name ?? '—'}
          school={red!.school}
          score={state.wins_red}
          winner={suspenseDone && winnerSide === 'red'}
          dimmed={suspenseDone && winnerSide !== null && winnerSide !== 'red'}
          revealed={suspenseDone}
        />
        <HealthBar
          side="white"
          name={white!.name ?? '—'}
          school={white!.school}
          score={state.wins_white}
          winner={suspenseDone && winnerSide === 'white'}
          dimmed={suspenseDone && winnerSide !== null && winnerSide !== 'white'}
          revealed={suspenseDone}
        />
      </header>

      {/* ── CENTER STAGE ── */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6">
        {/* Round indicator */}
        <div className="text-rose-300/80 text-xs sm:text-sm font-black tracking-[0.45em] uppercase mb-3">
          ▌ {'Bout'} · {match!.match_id} ▐
        </div>

        {/* Big central timer or alert */}
        {timerActive ? (
          <div className="text-center">
            <div
              className="font-black tabular-nums leading-none"
              style={{
                fontSize: 'clamp(6rem, 18vw, 16rem)',
                letterSpacing: '-0.04em',
                color: timerCritical ? undefined : '#fef3c7',
                textShadow: '0 0 30px rgba(254, 243, 199, 0.5)',
                animation: timerCritical ? 'sfrcTimerCritical 0.8s ease-in-out infinite' : undefined,
              }}
            >
              {formatMMSS(matchSeconds)}
            </div>
            <div className="mt-3 text-rose-400 font-black tracking-[0.5em] text-sm sm:text-base"
              style={{ animation: 'sfrcLive 1s ease-in-out infinite' }}>
              ● {matchSeconds < MATCH_DURATION_SEC - 1.2 ? 'FIGHTING' : 'GO!'} ●
            </div>
          </div>
        ) : isCountdown ? (
          <CenterText
            text={
              cdRemaining === null ? '5'
              : String(Math.ceil(cdRemaining))
            }
            color="text-amber-300"
            small={'GET READY'}
          />
        ) : inSuspense ? (
          <SuspenseStage />
        ) : suspenseDone ? (
          <ResultStage method={method} winnerSide={winnerSide} red={red!} white={white!} />
        ) : (
          // waiting / positioning
          <CenterText text={'ROBOTS IN ARENA'} color="text-rose-200" />
        )}
      </main>

      {/* ── BOTTOM SCOREBOARD ── */}
      <div className="relative z-20 overflow-hidden border-t border-rose-900/40 bg-black/60 h-8 flex items-center shrink-0">
        <div
          className="flex whitespace-nowrap text-[11px] tracking-[0.28em] font-bold uppercase text-rose-400/40"
          style={{ animation: 'sfrcMarquee 55s linear infinite' }}
        >
          {[0, 1].map(i => (
            <span key={i}>{`ASSOCIATION OF ROBOTICS AND ENGINEERING OF UZBEKISTAN · STARTUP FEST ROBOTICS CHALLENGE · ${eventSettings.year} · MINIROBOWAR · `.repeat(4)}</span>
          ))}
        </div>
      </div>
      <footer className="relative z-20 border-t-2 border-rose-700/50 bg-black/70 backdrop-blur-sm px-6 sm:px-10 py-3">
        <div className="grid grid-cols-3 items-center">
          <div className="text-xs font-black tracking-[0.3em] uppercase text-rose-300">
            ▌ {'JUDGES SCORECARD'} ▐
          </div>
          <div className="text-center text-rose-200/70 text-xs font-bold tracking-widest uppercase">
            {suspenseDone ? (
              <>
                <span className="text-rose-400 font-black">{state.wins_red}</span>
                <span className="mx-2 text-rose-600/50">·</span>
                {'Judge Score'}
                <span className="mx-2 text-rose-600/50">·</span>
                <span className="text-cyan-300 font-black">{state.wins_white}</span>
              </>
            ) : (
              <span className="text-amber-300/80 font-black tracking-[0.4em]" style={{ animation: 'sfrcArcadeFlicker 2.5s linear infinite' }}>
                🔒 SCORES SEALED · JUDGES SCORING
              </span>
            )}
          </div>
          <div className="text-right text-[10px] font-black tracking-[0.3em] uppercase text-rose-300/70">
            SFRC · MINIROBOWAR · {eventSettings.year}
          </div>
        </div>
      </footer>

      {/* Branded trophy card — settles in ~3s after the KO/IMM/JD slam reveal.
          Shows the actual winner team name + judge scores + serial + watermark. */}
      {isMatchOver && winnerSide && winnerSide !== 'draw' && phaseElapsed >= RESULT_SUSPENSE_MS + 3000 && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <TrophyCard
            accent={winnerSide === 'red' ? 'red' : 'cyan'}
            serial={match!.match_id}
            watermark={eventWatermark}
            caption={`${'MiniRoboWar'} · SFRC`}
            label={`${'WINNER'}${method ? ` · ${method === 'KO' ? 'K.O.!' : method === 'IMM' ? 'IMMOBILIZED!' : "JUDGES' DECISION"}` : ''}`}
            winnerName={(winnerSide === 'red' ? red! : white!).name ?? '—'}
          >
            <TrophyCrest accent="red" code={teamCode(red!.name)} />
            <div className="font-black tabular-nums text-white leading-none" style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.04em' }}>
              {state.wins_red} <span className="text-white/40">—</span> {state.wins_white}
            </div>
            <TrophyCrest accent="cyan" code={teamCode(white!.name)} />
          </TrophyCard>
        </div>
      )}
    </div>
  )
}

// ── Health bar + player card per side ──
// `revealed=false` (during fighting) — bar shows a "Battle Intensity" placeholder,
//   no real judge score (judges' scores are sealed UFC-style).
// `revealed=true` (after bout) — dramatic reveal: bar drains/fills to actual score,
//   number counts up from 0 → score.
function HealthBar({
  side, name, school, score, winner, dimmed, revealed,
}: {
  side: 'red' | 'white'
  name: string
  school: string | null
  score: number
  winner: boolean
  dimmed: boolean
  revealed: boolean
}) {
  const isRed = side === 'red'
  const barColor = isRed
    ? 'from-rose-500 via-red-600 to-red-700'
    : 'from-cyan-300 via-blue-500 to-blue-700'
  const tagColor = isRed ? 'text-rose-300' : 'text-cyan-300'
  const tagText = isRed ? 'PLAYER 1' : 'PLAYER 2'

  // Displayed score counts up from 0 to `score` over ~1.4s once revealed.
  const displayedScore = useScoreReveal(revealed ? score : 0, revealed)
  const barPct = revealed ? displayedScore : 100   // pre-reveal: bar is full + animated

  return (
    <div className={`${dimmed ? 'opacity-40' : 'opacity-100'} transition-opacity duration-500 ${isRed ? '' : 'text-right'}`}>
      <div className={`flex items-baseline gap-2 ${isRed ? '' : 'justify-end'} mb-1`}>
        <span className={`text-[10px] sm:text-xs font-black tracking-[0.35em] uppercase ${tagColor}`}>
          {tagText}
        </span>
        {winner && (
          <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 tracking-wider"
            style={{ animation: 'sfrcKOSlam 0.55s ease-out' }}>
            🏆 WINNER
          </span>
        )}
      </div>
      <div className={`font-black uppercase leading-none tracking-tight ${isRed ? '' : 'text-right'}`}
        style={{ fontSize: 'clamp(1.8rem, 4.5vw, 3.5rem)' }}>
        {name}
      </div>
      {school && (
        <div className={`text-white/40 text-xs sm:text-sm mt-1 truncate ${isRed ? '' : 'text-right'}`}>
          {school}
        </div>
      )}
      {/* HP bar */}
      <div className={`mt-2 flex items-center gap-2 ${isRed ? '' : 'flex-row-reverse'}`}>
        <div className={`flex-1 h-6 sm:h-7 bg-black/60 border-2 ${isRed ? 'border-rose-500/50' : 'border-cyan-400/50'} overflow-hidden relative`}>
          <div
            className={`h-full bg-gradient-to-r ${barColor}`}
            style={{
              width: `${Math.max(0, Math.min(100, barPct))}%`,
              transition: revealed ? 'width 1.2s cubic-bezier(0.34, 1.2, 0.64, 1)' : 'width 0.25s ease',
              opacity: revealed ? 1 : 0.85,
              animation: !revealed ? 'sfrcCombatPulse 1.4s ease-in-out infinite' : undefined,
            }}
          />
          {!revealed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-white/80 text-[10px] font-black tracking-[0.4em] uppercase mix-blend-overlay">
                ▮▮▮ BATTLE LIVE ▮▮▮
              </span>
            </div>
          )}
        </div>
        <div className={`font-black tabular-nums text-2xl sm:text-3xl ${isRed ? 'text-rose-300' : 'text-cyan-300'}`}>
          {revealed
            ? <>{displayedScore}<span className="text-white/30 text-base">/100</span></>
            : <span className="text-white/30">— / —</span>
          }
        </div>
      </div>
    </div>
  )
}

// Count-up from 0 to `target` over ~1.4s. Reset to 0 when active flips false.
function useScoreReveal(target: number, active: boolean): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const start = Date.now()
    const duration = 1400
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    let raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active])
  return val
}

// ── Centered text (countdown digits / GO! / READY) ──
function CenterText({ text, color, small }: { text: string; color: string; small?: string }) {
  return (
    <div className="text-center">
      {small && (
        <div className="text-rose-300/70 text-xs sm:text-sm font-black tracking-[0.4em] uppercase mb-3">
          ▌ {small} ▐
        </div>
      )}
      <div
        className={`font-black tabular-nums leading-none ${color}`}
        style={{
          fontSize: 'clamp(6rem, 18vw, 16rem)',
          letterSpacing: '-0.04em',
          textShadow: '0 0 40px rgba(254, 215, 170, 0.7)',
          animation: 'sfrcKOSlam 0.4s ease-out',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ── Suspense "calculating result" stage before the real reveal ──
// FTC-style build-up: indeterminate loading bar + animated dots, ~2.2s.
function SuspenseStage() {
  return (
    <div className="text-center">
      <div className="text-amber-300/80 text-xs sm:text-sm font-black tracking-[0.5em] uppercase mb-6">
        ▌ {"JUDGES' DECISION"} ▐
      </div>
      <div
        className="font-black uppercase tracking-tight text-white/80"
        style={{
          fontSize: 'clamp(3rem, 8vw, 6.5rem)',
          letterSpacing: '0.04em',
        }}
      >
        CALCULATING
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0s infinite', display: 'inline-block', marginLeft: '0.4em' }}>.</span>
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0.2s infinite', display: 'inline-block' }}>.</span>
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0.4s infinite', display: 'inline-block' }}>.</span>
      </div>

      {/* Indeterminate loading bar */}
      <div className="mt-8 mx-auto max-w-2xl h-2 bg-white/10 border border-white/20 overflow-hidden relative">
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-transparent via-amber-300 to-transparent"
          style={{
            width: '30%',
            animation: 'sfrcLoadingBar 1.6s ease-in-out infinite',
            filter: 'drop-shadow(0 0 12px rgba(252,211,77,0.7))',
          }}
        />
      </div>

      <div className="mt-6 text-white/40 text-xs tracking-[0.4em] uppercase">
        ▰▰▰▰▰▱▱▱▱▱  reviewing footage
      </div>
    </div>
  )
}

// ── Big result alert (K.O., IMM, JD) ──
function ResultStage({
  method, winnerSide, red, white,
}: {
  method: 'KO' | 'IMM' | 'JD' | null
  winnerSide: 'red' | 'white' | 'draw' | null
  red: TeamLite
  white: TeamLite
}) {
  if (winnerSide === 'draw') {
    return (
      <div className="text-center">
        <div className="font-black text-amber-300 tracking-tight" style={{ fontSize: 'clamp(5rem, 12vw, 10rem)', animation: 'sfrcKOSlam 0.55s ease-out' }}>
          {'DRAW'}
        </div>
        <div className="mt-2 text-amber-200/80 text-lg sm:text-2xl font-bold uppercase tracking-widest">
          {"JUDGES' DECISION"}
        </div>
      </div>
    )
  }

  const winnerName = winnerSide === 'red' ? red.name : white.name
  const headline =
    method === 'KO' ? 'K.O.!'
    : method === 'IMM' ? 'IMMOBILIZED!'
    : "JUDGES' DECISION"
  // Color KO/IMM in the winner's side color; JD stays neutral cyan.
  const headlineColor =
    method === 'JD' ? 'text-cyan-200'
    : winnerSide === 'red' ? 'text-rose-400'
    : winnerSide === 'white' ? 'text-cyan-200'
    : 'text-amber-300'

  return (
    <div className="text-center">
      <div
        className={`font-black uppercase tracking-tight ${headlineColor}`}
        style={{
          fontSize: 'clamp(5rem, 14vw, 12rem)',
          letterSpacing: '-0.02em',
          textShadow:
            method === 'JD' ? '0 0 40px rgba(165,243,252,0.8)'
            : winnerSide === 'red' ? '0 0 40px rgba(244,63,94,1), 0 0 100px rgba(244,63,94,0.7)'
            : winnerSide === 'white' ? '0 0 40px rgba(165,243,252,1), 0 0 100px rgba(165,243,252,0.6)'
            : '0 0 40px rgba(252,211,77,0.8)',
          animation: 'sfrcKOSlam 0.6s ease-out',
        }}
      >
        {headline}
      </div>
      <div className="mt-4 inline-flex items-center gap-3 bg-amber-400 text-black px-6 py-2"
        style={{ animation: 'sfrcKOSlam 0.7s ease-out 0.15s both' }}>
        <span className="text-2xl">🏆</span>
        <span className="font-black tracking-[0.3em] text-sm sm:text-base">{'WINNER'}: {winnerName}</span>
      </div>
    </div>
  )
}

// ── Idle / On-deck preview ──
function ArenaIdle({ next }: { next: NextMatch | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white relative overflow-hidden px-6 sm:px-12 py-10"
      style={{ fontFamily: '"Anton", "Impact", "Arial Black", sans-serif' }}>
      <SparkLayer />

      {/* Big category title */}
      <div className="relative z-10 text-rose-300 font-black tracking-[0.45em] uppercase mb-6 sm:mb-10 text-center"
        style={{
          fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
          animation: 'sfrcMagentaPulse 3s ease-in-out infinite',
        }}>
        ▌ {'MiniRoboWar'} ▐
      </div>

      {next && next.red && next.white ? (
        <>
          {/* Bigger next-bout banner */}
          <div
            className="relative z-10 bg-amber-400/10 border-2 border-amber-400/60 px-6 sm:px-10 py-3 sm:py-4 mb-8 sm:mb-14"
            style={{ animation: 'sfrcBorderCycle 4s ease-in-out infinite' }}
          >
            <div className="text-amber-300 font-black tracking-[0.4em] uppercase text-center"
              style={{ fontSize: 'clamp(1rem, 2.4vw, 2rem)' }}>
              ⚡ {'NEXT BOUT'} <span className="text-white/40 mx-2">·</span> <span className="font-mono">#{next.match_id}</span>
            </div>
          </div>

          {/* Equal-width 3-col layout: player1 | VS | player2 (each player 5fr, VS 2fr — both names centered in their cell) */}
          <div className="relative z-10 grid grid-cols-[5fr_2fr_5fr] gap-4 sm:gap-8 items-center w-full max-w-7xl mx-auto">
            <PlayerCell side="red"   label={'Player 1'} name={next.red.name ?? '—'}   school={next.red.school} />
            <div className="text-rose-500 font-black text-center"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', animation: 'sfrcArcadeFlicker 2s linear infinite' }}>
              VS
            </div>
            <PlayerCell side="white" label={'Player 2'} name={next.white.name ?? '—'} school={next.white.school} />
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 text-rose-200 font-black uppercase tracking-tight text-center mb-3"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}>
            {'Awaiting next bout'}
          </div>
          <div className="relative z-10 text-white/40 text-base sm:text-xl uppercase tracking-widest text-center">{'Arena clear · standby'}</div>
        </>
      )}
    </div>
  )
}

// Player cell for on-deck preview — equal width, names centered inside cell with auto-shrink for long names.
function PlayerCell({
  side, label, name, school,
}: {
  side: 'red' | 'white'
  label: string
  name: string
  school: string | null
}) {
  const isRed = side === 'red'
  const labelColor = isRed ? 'text-rose-400' : 'text-cyan-400'
  return (
    <div className="text-center min-w-0">
      <div className={`${labelColor} font-black tracking-[0.45em] uppercase mb-2`}
        style={{ fontSize: 'clamp(0.7rem, 1.2vw, 1rem)' }}>
        {label}
      </div>
      <div
        className="font-black uppercase leading-[1.05] break-words"
        style={{
          // Larger overall; clamps down on very long names so the row stays balanced.
          fontSize: 'clamp(1.6rem, 4.4vw, 4.5rem)',
          letterSpacing: '-0.01em',
        }}
      >
        {name}
      </div>
      {school && (
        <div className="text-white/50 mt-2 truncate"
          style={{ fontSize: 'clamp(0.75rem, 1.1vw, 1.1rem)' }}>
          {school}
        </div>
      )}
    </div>
  )
}

// ── Finals bracket overlay ──
function FinalsBracketOverlayC({ matches }: { matches: BracketMatchC[] }) {
  const sf1    = matches.find(m => m.match_id === 'FC-SF1') ?? null
  const sf2    = matches.find(m => m.match_id === 'FC-SF2') ?? null
  const final_ = matches.find(m => m.match_id === 'FC-F1')  ?? null
  const third  = matches.find(m => m.match_id === 'FC-3RD') ?? null

  // Derive winner/loser names from SF results for TBD labels
  const nameOf = (m: BracketMatchC | null, side: 'winner' | 'loser') => {
    if (!m) return null
    if (!m.winner) return null
    const w = m.winner === 1 ? m.red?.name : m.white?.name
    const l = m.winner === 1 ? m.white?.name : m.red?.name
    return side === 'winner' ? (w ?? null) : (l ?? null)
  }

  // Build full bracket — always include all 4 slots so FinalsBracketB draws connecting lines
  const tbd = (id: string, n: string | null) => ({ id, name: n ?? '', school: null })

  const fullMatches: BracketMatchC[] = [
    // Semis (always exist once generated)
    ...(sf1 ? [sf1] : []),
    ...(sf2 ? [sf2] : []),
    // Final — use real match if exists, else virtual with TBD names from SF results
    final_ ?? {
      match_id: 'FC-F1', status: 'pending',
      red:   tbd('f-r', nameOf(sf1, 'winner')),
      white: tbd('f-w', nameOf(sf2, 'winner')),
      winner: null, rounds1: null, rounds2: null,
    },
    // 3rd place — same
    third ?? {
      match_id: 'FC-3RD', status: 'pending',
      red:   tbd('t-r', nameOf(sf1, 'loser')),
      white: tbd('t-w', nameOf(sf2, 'loser')),
      winner: null, rounds1: null, rounds2: null,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #2a0508 0%, #0a0306 65%, #02010a 100%)',
        fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
      }}
    >
      <SparkLayer />
      <div className="relative z-10 w-full flex flex-col items-center gap-8">
        <div className="text-rose-300 font-black tracking-[0.5em] uppercase text-center"
          style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}>
          ▌ MINIROBOWARS · FINALS ▐
        </div>
        <div className="overflow-x-auto w-full flex justify-center">
          <FinalsBracketB matches={fullMatches} dark scale={1.6} colGapMult={1.5} />
        </div>
        <div className="text-rose-300/20 text-[10px] tracking-[0.4em] uppercase">
          SFRC · STARTUP FEST ROBOTICS CHALLENGE
        </div>
      </div>
    </div>
  )
}

// ── Decorative spark animations ──
function SparkLayer() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1/3"
        style={{
          background: 'radial-gradient(ellipse at 30% 0, rgba(244,63,94,0.18) 0, transparent 60%)',
        }}
      />
      <div className="absolute bottom-0 right-0 w-full h-1/3"
        style={{
          background: 'radial-gradient(ellipse at 70% 100%, rgba(59,130,246,0.15) 0, transparent 60%)',
        }}
      />
    </div>
  )
}
