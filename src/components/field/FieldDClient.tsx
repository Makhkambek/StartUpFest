'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useEventSettings } from '@/lib/use-event-settings'
import type { LiveStateB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import FinalsBracketD from '@/components/public/FinalsBracketD'

interface TeamLite {
  id: string
  name: string | null
  school: string | null
  alliance_name?: string | null
}

interface NextMatch {
  match_id: string
  status: ScheduledMatch['status']
  red: TeamLite | null
  redPartner: TeamLite | null
  white: TeamLite | null
  whitePartner: TeamLite | null
}

interface FinalsMatchD {
  match_id: string
  status: string
  red: TeamLite | null
  redPartner: TeamLite | null
  white: TeamLite | null
  whitePartner: TeamLite | null
  goals1: number | null
  goals2: number | null
}

interface FieldStateD {
  state: LiveStateB
  match: ScheduledMatch | null
  red: TeamLite | null
  redPartner: TeamLite | null
  white: TeamLite | null
  whitePartner: TeamLite | null
  nextMatch: NextMatch | null
  finalsData?: FinalsMatchD[] | null
}

interface GoalEvent { time: string; side: 'red' | 'white'; half: number }

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COUNTDOWN_SECONDS = 5
const HALF_DURATION_SEC = 120
const GOAL_OVERLAY_MS = 3500

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

// Reverse half timer (2:00 → 0:00).
//   active            — currently fighting (or local countdown finished, just before fighting)
//   phase             — current LiveStateB phase (used to decide: tick / freeze / reset)
//   matchKey          — change forces reset (new match started, or new half kicked off)
//   serverHalfStartAt — countdown_started_at when phase==fighting (= the kickoff moment).
//                       We rebase the timer on this so all clients/tabs stay in sync with
//                       the server's authoritative kickoff time instead of each computing
//                       their own local "when countdown hit 0" — cross-tab drift would
//                       otherwise be 100–500ms which looks bad on a shared venue display.
//
// Rule:
//   • fighting       → tick down from 2:00 rebased on serverHalfStartAt
//   • round_result   → freeze last value (audience sees final time of the half)
//   • match_result   → freeze last value
//   • anything else (idle/waiting/positioning/countdown) → reset to full 2:00 immediately
function useHalfTimer(
  active: boolean,
  phase: LiveStateB['phase'],
  matchKey: string,
  serverHalfStartAt: string | null,
) {
  const [secondsLeft, setSecondsLeft] = useState(HALF_DURATION_SEC)
  const shouldFreeze = phase === 'round_result' || phase === 'match_result'

  useEffect(() => {
    // Pre-fight states: always show fresh 2:00. Critical that this happens
    // synchronously so a new match doesn't briefly inherit the previous match's
    // frozen "0:14" value during ROBOTS ON PITCH.
    if (!active && !shouldFreeze) {
      setSecondsLeft(HALF_DURATION_SEC)
      return
    }
    if (!active) return  // freeze (round_result / match_result)

    // During fighting, anchor the timer on the server's kickoff timestamp when
    // available. Falls back to local Date.now() if the field display learned
    // about `fighting` before receiving the new countdown_started_at (rare —
    // realtime push usually carries both fields atomically).
    const serverStartMs = phase === 'fighting' && serverHalfStartAt
      ? Date.parse(serverHalfStartAt)
      : Date.now()

    const tick = () => {
      const r = HALF_DURATION_SEC - (Date.now() - serverStartMs) / 1000
      setSecondsLeft(r > 0 ? r : 0)
    }
    tick()  // immediate — no flash of 02:00 if some time already elapsed
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [active, shouldFreeze, matchKey, phase, serverHalfStartAt])
  return secondsLeft
}

function formatMMSS(s: number): string {
  const mm = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function teamCode(name: string | null | undefined): string {
  if (!name) return '—'
  const cleaned = name.replace(/\[.*?\]/g, '').trim()
  const letters = cleaned.replace(/[^a-zA-ZА-Яа-яЁё]/g, '').toUpperCase()
  return letters.slice(0, 3) || '—'
}

export default function FieldDClient() {
  const { watermark: eventWatermark } = useEventSettings('en')
  const [data, setData] = useState<FieldStateD | null>(null)
  const lastFetchAt = useRef(Date.now())
  const [stale, setStale] = useState(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/field/d/state', { cache: 'no-store' })
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

  // Always poll (cheap GET). In Supabase mode realtime is the primary signal, but if the
  // publication isn't configured for live_match_state the client would never see updates —
  // polling is the safety net. 4s is invisible to viewers and keeps shared-IP venue
  // traffic under the rate limit when many field/judge devices are behind one NAT.
  useEffect(() => {
    const interval = hasSupabase ? 4000 : 300
    const id = setInterval(refetch, interval)
    return () => clearInterval(id)
  }, [refetch])

  // Supabase realtime — fires on top of polling for instant updates.
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
      channel = supabase.channel(`field-d-${Date.now()}`)
      for (const table of ['live_match_state', 'scheduled_matches', 'teams', 'matches_d']) {
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

  const [splashDone, setSplashDone] = useState(false)

  const handleSplash = useCallback(() => {
    const ctx = getCtx()
    ctx?.resume().catch(() => {})
    setSplashDone(true)
  }, [])

  if (!splashDone) return <SoundSplash onStart={handleSplash} />
  if (!data) return <BootD />
  return (
    <>
      <FifaView data={data} eventWatermark={eventWatermark} />
      {data.state.finals_visible && data.finalsData && data.finalsData.length > 0 && (
        <FinalsOverlayD items={data.finalsData} />
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden text-white select-none"
      style={{
        background: 'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)',
        fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
      }}
    >
      <PitchPattern />
      <div className="relative z-10 text-center px-8 flex flex-col items-center">
        {/* Event name */}
        <div
          className="font-black tracking-[0.3em] uppercase text-emerald-300/70 mb-2"
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
          className="text-emerald-300 font-black tracking-[0.45em] uppercase mb-3"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}
        >
          Robo Football
        </div>
        <div className="w-48 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent mb-8 mx-auto" />

        {/* BREAK */}
        <div
          className="text-emerald-200 font-black uppercase tracking-tight text-center mb-5"
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

function BootD() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a1e0a] text-emerald-400 text-2xl tracking-widest font-black">
      ⚽ LOADING ⚽
    </div>
  )
}

function SoundSplash({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center cursor-pointer select-none relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)' }}
      onClick={onStart}
    >
      <PitchPattern />
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8">
        <div className="text-emerald-400 font-black tracking-[0.45em] uppercase"
          style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}>
          ⚽ ROBO FOOTBALL
        </div>
        <div
          className="font-black uppercase text-white leading-tight"
          style={{ fontSize: 'clamp(3rem, 9vw, 7rem)', letterSpacing: '-0.03em', textShadow: '0 0 40px rgba(16,185,129,0.5)' }}
        >
          TAP TO START
        </div>
        <div className="text-emerald-300/60 font-mono tracking-widest uppercase"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)', animation: 'sfrcArcadeFlicker 2s linear infinite' }}>
          🔊 click to enable sound
        </div>
      </div>
    </div>
  )
}

// ── Sound system ─────────────────────────────────────────────────────────
// AudioContext is created lazily on first user interaction (browser policy).
let _ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

function playBeep(freq: number, duration: number, vol = 0.5) {
  const ctx = getCtx()
  if (!ctx || ctx.state === 'suspended') return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.start(); osc.stop(ctx.currentTime + duration)
}

const _buffers: Partial<Record<string, AudioBuffer>> = {}

async function playWhistle(src: string) {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') await ctx.resume()
  if (!_buffers[src]) {
    try {
      const res = await fetch(src)
      const arr = await res.arrayBuffer()
      _buffers[src] = await ctx.decodeAudioData(arr)
    } catch { return }
  }
  const buf = _buffers[src]
  if (!buf) return
  const source = ctx.createBufferSource()
  source.buffer = buf
  source.connect(ctx.destination)
  source.start()
}

// Countdown beep at each whole second (5→4→3→2→1) + whistle on phase change.
function useMatchSound(phase: LiveStateB['phase'], cdRemaining: number | null) {
  const prevPhaseRef = useRef<LiveStateB['phase']>('idle')
  const prevCeilRef  = useRef<number | null>(null)

  // Countdown beeps: fire when the displayed integer drops by 1
  useEffect(() => {
    if (cdRemaining === null) { prevCeilRef.current = null; return }
    const ceil = Math.ceil(cdRemaining)
    if (ceil !== prevCeilRef.current && ceil >= 1 && ceil <= 5) {
      // Higher pitch on 1 so the last beep stands out
      playBeep(ceil === 1 ? 1200 : 880, 0.12, 0.6)
    }
    prevCeilRef.current = ceil
  }, [cdRemaining])

  // Whistle on phase transitions
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === 'fighting' && prev !== 'fighting') {
      playWhistle('/sounds/whistle-start.wav')
    }
    if ((phase === 'round_result' || phase === 'match_result') && prev === 'fighting') {
      playWhistle('/sounds/whistle-end.wav')
    }
  }, [phase])
}

function FifaView({ data, eventWatermark }: { data: FieldStateD; eventWatermark: string }) {
  const { state, match, red, redPartner, white, whitePartner, nextMatch } = data
  const isRunning = state.phase === 'fighting'
  const isCountdown = state.phase === 'countdown'
  const isHalftime = state.phase === 'round_result'
  const isMatchOver = state.phase === 'match_result'

  // hasMatch: there's an active match in state — even if team data is still loading.
  const hasActive = state.phase !== 'idle' && !!state.active_match_id
  const hasMatch = hasActive && match && red && white
  // Show loading state if we have active_match but teams haven't loaded yet.
  const isWaitingForData = hasActive && (!match || !red || !white)

  const cdRemaining = useCountdown(state.countdown_started_at, state.phase)
  useMatchSound(state.phase, cdRemaining)
  const countdownFinished = isCountdown && cdRemaining !== null && cdRemaining <= 0
  const timerActive = isRunning || countdownFinished
  // matchKey combines active_match_id + round_number so the timer resets when
  // a new match starts OR a new half begins within the same match.
  const halfMatchKey = `${state.active_match_id ?? 'idle'}-${state.round_number}`
  const halfSeconds = useHalfTimer(timerActive, state.phase, halfMatchKey, state.countdown_started_at)

  // Detect a new goal and play GOAL overlay for GOAL_OVERLAY_MS.
  const totalGoals = state.wins_red + state.wins_white
  const [goalOverlay, setGoalOverlay] = useState<{ side: 'red' | 'white'; ts: number } | null>(null)
  const prevTotalRef = useRef(totalGoals)
  useEffect(() => {
    const prev = prevTotalRef.current
    prevTotalRef.current = totalGoals
    if (totalGoals > prev) {
      const side = state.last_round_winner === 'red' ? 'red' : 'white'
      setGoalOverlay({ side, ts: Date.now() })
      const id = setTimeout(() => setGoalOverlay(null), GOAL_OVERLAY_MS)
      return () => clearTimeout(id)
    }
  }, [totalGoals, state.last_round_winner])

  if (!hasMatch) {
    if (isWaitingForData) return <PitchLoading />
    return <PitchIdle next={nextMatch} />
  }

  const winnerSide: 'red' | 'white' | 'draw' | null =
    state.match_winner === 1 ? 'red'
    : state.match_winner === 2 ? 'white'
    : state.match_winner === 0 ? 'draw'
    : null

  // During the half-time break (round_result after half 1), the top bar should
  // signal what's next, not stay on "1ST HALF" which reads as still-in-progress.
  // Pattern: "HALF-TIME → 2ND HALF" so audiences/judges know the next phase.
  const halfLabel = (() => {
    const current =
      state.round_number === 1 ? '1ST HALF'
      : state.round_number === 2 ? '2ND HALF'
      : state.round_number === 3 ? 'EXTRA TIME'
      : 'PENALTIES'

    if (isHalftime) {
      const next =
        state.round_number === 1 ? '2ND HALF'
        : state.round_number === 2 ? 'EXTRA TIME'
        : state.round_number === 3 ? 'PENALTIES'
        : null
      return next ? `HALF-TIME → ${next}` : 'HALF-TIME'
    }
    return current
  })()

  const lastGoal = (() => {
    const raw = (state.round_history as unknown) ?? []
    if (!Array.isArray(raw) || raw.length === 0) return null
    return raw[raw.length - 1] as GoalEvent
  })()

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col text-white select-none relative"
      style={{
        background:
          'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)',
        fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
      }}
    >
      <PitchPattern />


      {/* ── TOP SCORE-BUG ── (hidden on full-time so the trophy card is the only composition) */}
      {!isMatchOver && (
      <header className="relative z-30 px-6 sm:px-10 py-3 flex items-center justify-between bg-black/60 backdrop-blur-md border-b border-emerald-500/30"
        style={{ animation: 'sfrcScoreBugSlide 0.5s ease-out' }}>
        <div className="flex items-center gap-3 sm:gap-5">
          <AllianceBadge side="red"   team={red!} partner={redPartner} />
          <span className="font-black tabular-nums leading-none whitespace-nowrap" style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}>
            <span className="text-rose-300" style={{ animation: state.last_round_winner === 'red' ? 'sfrcScoreTick 0.5s ease-out' : undefined, display: 'inline-block' }}>
              {state.wins_red}
            </span>
            <span className="mx-2 sm:mx-3 text-white/40">—</span>
            <span className="text-cyan-300" style={{ animation: state.last_round_winner === 'white' ? 'sfrcScoreTick 0.5s ease-out' : undefined, display: 'inline-block' }}>
              {state.wins_white}
            </span>
          </span>
          <AllianceBadge side="white" team={white!} partner={whitePartner} />
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="text-right">
            <div className="text-[9px] sm:text-[11px] font-black tracking-[0.3em] text-emerald-300/80 uppercase">{halfLabel}</div>
            <div className="text-base sm:text-xl font-mono font-black tabular-nums leading-none mt-0.5">
              {isCountdown && cdRemaining !== null ? `${Math.ceil(cdRemaining)}.0` : formatMMSS(halfSeconds)}
            </div>
          </div>
          {isRunning && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full" style={{ animation: 'sfrcLive 1.1s ease-in-out infinite' }} />
              <span className="text-[10px] font-black tracking-widest text-white">LIVE</span>
            </span>
          )}
        </div>
      </header>
      )}

      {/* ── MAIN STAGE ── */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6 sm:px-10">
        {isCountdown && cdRemaining !== null ? (
          <CenterBig
            text={cdRemaining <= 0.25 ? 'GO!' : String(Math.ceil(cdRemaining))}
            color="text-amber-300"
            small="GET READY"
          />
        ) : isHalftime ? (
          <HalftimeStage red={red!} redPartner={redPartner} white={white!} whitePartner={whitePartner} state={state} />
        ) : isMatchOver ? (
          <FullTimeStage red={red!} redPartner={redPartner} white={white!} whitePartner={whitePartner} state={state} winnerSide={winnerSide} matchId={match!.match_id} eventWatermark={eventWatermark} />
        ) : isRunning ? (
          <KickoffOrLive
            red={red!}
            redPartner={redPartner}
            white={white!}
            whitePartner={whitePartner}
            lastGoal={lastGoal}
            scoreRed={state.wins_red}
            scoreWhite={state.wins_white}
          />
        ) : (
          <CenterBig text="ROBOTS ON PITCH" color="text-emerald-200" />
        )}
      </main>

      {/* ── BOTTOM TICKER ── */}
      <footer className="relative z-20 overflow-hidden border-t border-emerald-500/20 bg-black/60 h-9 flex items-center shrink-0">
        <div
          className="flex whitespace-nowrap text-[11px] tracking-[0.28em] font-bold uppercase text-emerald-400/50"
          style={{ animation: 'sfrcMarquee 55s linear infinite' }}
        >
          {[0, 1].map(i => (
            <span key={i}>{`ASSOCIATION OF ROBOTICS AND ENGINEERING OF UZBEKISTAN · STARTUP FEST ROBOTICS CHALLENGE · ${eventWatermark} · ROBO FOOTBALL · `.repeat(4)}</span>
          ))}
        </div>
      </footer>

      {/* ── GOAL OVERLAY ── */}
      {goalOverlay && <GoalOverlay key={goalOverlay.ts} side={goalOverlay.side} scoredBy={goalOverlay.side === 'red' ? red!.name : white!.name} />}
    </div>
  )
}

// ── Crest-style code badge (PHX, CYC) ──
function CodeBadge({ side, text }: { side: 'red' | 'white'; text: string }) {
  const isRed = side === 'red'
  const grad = isRed
    ? 'from-rose-600 via-red-700 to-red-900'
    : 'from-cyan-500 via-blue-600 to-blue-800'
  return (
    <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-gradient-to-br ${grad} shadow-lg border border-white/15`}
      style={{ animation: 'sfrcCrestPulse 3.5s ease-in-out infinite' }}>
      <span className="font-black tracking-[0.15em] text-white" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.5rem)' }}>
        {text}
      </span>
    </div>
  )
}

// Alliance badge: two team codes joined with "+", e.g. "BIN + AUT".
// Falls back to single CodeBadge when no partner.
function AllianceBadge({ side, team, partner }: { side: 'red' | 'white'; team: TeamLite; partner: TeamLite | null }) {
  if (!partner) return <CodeBadge side={side} text={teamCode(team.name)} />
  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <CodeBadge side={side} text={teamCode(team.name)} />
      <span className="text-white/40 font-black text-xs sm:text-base">+</span>
      <CodeBadge side={side} text={teamCode(partner.name)} />
    </div>
  )
}

function CenterBig({ text, color, small }: { text: string; color: string; small?: string }) {
  return (
    <div className="text-center">
      {small && (
        <div className="text-emerald-300/70 text-xs sm:text-sm font-black tracking-[0.4em] uppercase mb-3">
          ▌ {small} ▐
        </div>
      )}
      <div
        className={`font-black tabular-nums leading-none ${color}`}
        style={{
          fontSize: 'clamp(6rem, 18vw, 16rem)',
          letterSpacing: '-0.04em',
          textShadow: '0 0 40px rgba(254, 215, 170, 0.5)',
          animation: 'sfrcKOSlam 0.4s ease-out',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ── Main "live" content area: big team crests + score, last goal info ──
function KickoffOrLive({
  red, redPartner, white, whitePartner, lastGoal, scoreRed, scoreWhite,
}: {
  red: TeamLite
  redPartner: TeamLite | null
  white: TeamLite
  whitePartner: TeamLite | null
  lastGoal: GoalEvent | null
  scoreRed: number
  scoreWhite: number
}) {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
      {/* Two alliances with their OWN big score on top — no floating center number */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-10 items-start w-full mb-6 sm:mb-10">
        <SideScoreboard side="red"   team={red}   partner={redPartner}   score={scoreRed}   />
        <CenterDivider lastGoal={lastGoal} red={red} white={white} />
        <SideScoreboard side="white" team={white} partner={whitePartner} score={scoreWhite} />
      </div>
    </div>
  )
}

// One side of the scoreboard: huge score directly above its alliance crests.
// Score is glued to the team identity, no ambiguity about who has what.
function SideScoreboard({
  side, team, partner, score,
}: {
  side: 'red' | 'white'
  team: TeamLite
  partner: TeamLite | null
  score: number
}) {
  const isRed = side === 'red'
  const scoreColor = isRed ? 'text-rose-300' : 'text-cyan-300'
  const glow = isRed
    ? '0 0 50px rgba(244,63,94,0.55), 0 0 110px rgba(244,63,94,0.25)'
    : '0 0 50px rgba(59,130,246,0.55), 0 0 110px rgba(59,130,246,0.25)'
  return (
    <div className="flex flex-col items-center min-w-0 w-full">
      <div
        className={`font-black tabular-nums leading-none ${scoreColor} mb-3 sm:mb-5`}
        style={{
          fontSize: 'clamp(5rem, 13vw, 11rem)',
          letterSpacing: '-0.05em',
          textShadow: glow,
          animation: 'sfrcScoreTick 0.4s ease-out',
        }}
        key={score}
      >
        {score}
      </div>
      <AllianceColumn side={side} team={team} partner={partner} />
    </div>
  )
}

// Center column: VS divider with optional last-goal ticker stacked underneath.
function CenterDivider({
  lastGoal, red, white,
}: {
  lastGoal: GoalEvent | null
  red: TeamLite
  white: TeamLite
}) {
  return (
    <div className="flex flex-col items-center justify-start gap-3 sm:gap-4 px-2 sm:px-4 pt-2">
      <div className="text-emerald-300 font-black tracking-tight leading-none"
        style={{
          fontSize: 'clamp(2.2rem, 5vw, 4.5rem)',
          textShadow: '0 0 24px rgba(16,185,129,0.5)',
          animation: 'sfrcArcadeFlicker 2.5s linear infinite',
        }}>
        VS
      </div>
      <div className="w-px h-12 sm:h-20 bg-emerald-400/40" />
      {lastGoal && (
        <div className="bg-black/60 border border-emerald-400/30 rounded-md px-3 py-2 flex flex-col items-center gap-1 backdrop-blur-sm whitespace-nowrap"
          style={{ animation: 'sfrcScoreBugSlide 0.5s ease-out' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-300 text-xs sm:text-sm">⚽</span>
            <span className="text-amber-300 font-black tracking-widest text-[10px] sm:text-xs uppercase">Last goal</span>
            <span className="font-mono font-black text-xs sm:text-sm">{lastGoal.time}</span>
          </div>
          <div className={`font-black text-xs sm:text-sm ${lastGoal.side === 'red' ? 'text-rose-300' : 'text-cyan-300'}`}>
            {lastGoal.side === 'red' ? red.name : white.name}
          </div>
          <div className="text-white/40 text-[9px] uppercase tracking-wider">H{lastGoal.half}</div>
        </div>
      )}
    </div>
  )
}

// Alliance column: 2 equal partner teams (Robo Football has 4 teams per match).
// Falls back to single team if no partner (legacy data / categories A/B/C re-use).
function AllianceColumn({ side, team, partner }: {
  side: 'red' | 'white'
  team: TeamLite
  partner: TeamLite | null
}) {
  if (!partner) return <CrestColumn side={side} team={team} />

  const isRed = side === 'red'
  const grad = isRed
    ? 'from-rose-500 via-red-600 to-red-800'
    : 'from-cyan-400 via-blue-600 to-blue-800'
  const labelColor = isRed ? 'text-rose-300' : 'text-cyan-300'
  const sideLabel = isRed ? 'RED' : 'BLUE'

  return (
    <div className="text-center min-w-0 flex flex-col items-center">
      {/* Side label up top */}
      <div className={`${labelColor} font-black tracking-[0.45em] uppercase mb-3`}
        style={{ fontSize: 'clamp(0.8rem, 1.4vw, 1.2rem)' }}>
        ▌ {sideLabel} ▐
      </div>

      {/* Two equal crests side-by-side */}
      <div className="flex items-center gap-3 sm:gap-4 mb-3">
        <PartnerBlock grad={grad} team={team} animDelay="0s" />
        <PartnerBlock grad={grad} team={partner} animDelay="1.5s" />
      </div>
    </div>
  )
}

// Single team block inside an alliance: crest + team name underneath (equal sizing).
function PartnerBlock({ grad, team, animDelay }: { grad: string; team: TeamLite; animDelay: string }) {
  return (
    <div className="text-center min-w-0 flex-1 flex flex-col items-center">
      <div className={`relative w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-2xl border-2 border-white/20 mb-2`}
        style={{ animation: `sfrcCrestPulse 3.5s ease-in-out ${animDelay} infinite` }}>
        <span className="font-black tracking-[0.1em] text-white" style={{ fontSize: 'clamp(1rem, 2.4vw, 2rem)' }}>
          {teamCode(team.name)}
        </span>
      </div>
      <div className="font-black uppercase tracking-tight leading-tight break-words"
        style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.4rem)' }}>
        {team.name ?? '—'}
      </div>
      {team.school && (
        <div className="text-white/40 mt-0.5 truncate max-w-[12ch]"
          style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.85rem)' }}>
          {team.school}
        </div>
      )}
    </div>
  )
}

// Legacy single-team column (used when no partner is set, e.g. before migration 015).
function CrestColumn({ side, team }: { side: 'red' | 'white'; team: TeamLite }) {
  const isRed = side === 'red'
  const grad = isRed
    ? 'from-rose-500 via-red-600 to-red-800'
    : 'from-cyan-400 via-blue-600 to-blue-800'
  const labelColor = isRed ? 'text-rose-300' : 'text-cyan-300'
  const sideLabel = isRed ? 'RED' : 'BLUE'

  return (
    <div className="text-center min-w-0 flex flex-col items-center">
      <div className={`${labelColor} font-black tracking-[0.45em] uppercase mb-3`}
        style={{ fontSize: 'clamp(0.8rem, 1.4vw, 1.2rem)' }}>
        ▌ {sideLabel} ▐
      </div>
      <div className={`relative w-24 h-24 sm:w-36 sm:h-36 lg:w-44 lg:h-44 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center mb-3 shadow-2xl border-2 border-white/20`}
        style={{ animation: 'sfrcCrestPulse 3.5s ease-in-out infinite' }}>
        <span className="font-black tracking-[0.1em] text-white" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}>
          {teamCode(team.name)}
        </span>
      </div>
      <div className="font-black uppercase tracking-tight leading-tight break-words"
        style={{ fontSize: 'clamp(1.2rem, 2.6vw, 2.2rem)' }}>
        {team.name ?? '—'}
      </div>
      {team.school && (
        <div className="text-white/40 mt-1 truncate"
          style={{ fontSize: 'clamp(0.7rem, 1vw, 0.95rem)' }}>
          {team.school}
        </div>
      )}
    </div>
  )
}

// ── HALF-TIME interlude ──
function HalftimeStage({ red, redPartner, white, whitePartner, state }: {
  red: TeamLite
  redPartner: TeamLite | null
  white: TeamLite
  whitePartner: TeamLite | null
  state: LiveStateB
}) {
  // Mini-trophy-card layout for halftime — same glass panel + accent stripes as
  // full-time, but with HALFTIME caption instead of WINNERS and both sides
  // shown neutrally (no winner yet). Photo-worthy intermission card.
  const amberStripe =
    'linear-gradient(90deg, rgba(251,191,36,0) 0%, rgba(251,191,36,0.85) 50%, rgba(251,191,36,0) 100%)'

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 relative">
      <div className="relative border border-white/10 bg-black/35 backdrop-blur-md py-8 sm:py-12 px-6 sm:px-12"
        style={{ animation: 'sfrcScoreBugSlide 0.6s ease-out', willChange: 'transform, opacity' }}>

        {/* Top + bottom amber accent stripes (halftime = amber, not winner color) */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: amberStripe }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: amberStripe }} />

        {/* HALFTIME caption */}
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300/90 font-semibold tracking-[0.45em] uppercase"
            style={{ fontSize: 'clamp(0.7rem, 1vw, 0.85rem)' }}>
            1ST HALF → 2ND HALF
          </span>
        </div>

        {/* BIG HALFTIME label */}
        <div className="text-center mb-6 sm:mb-8">
          <span className="font-black tracking-[0.4em] uppercase text-amber-300"
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 4rem)',
              letterSpacing: '0.3em',
              textShadow: '0 0 24px rgba(251,191,36,0.35)',
            }}>
            HALF-TIME
          </span>
        </div>

        {/* SCORE row — alliance crests + big single-line score in the middle */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8 mb-8">
          {/* Red side crests */}
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <MiniCrest side="red" code={teamCode(red.name)} />
            {redPartner && <MiniCrest side="red" code={teamCode(redPartner.name)} />}
          </div>

          {/* Score — both sides neutral white, em-dash subtle */}
          <div className="font-black tabular-nums leading-none flex items-baseline gap-3 sm:gap-5 whitespace-nowrap text-white"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 7rem)', letterSpacing: '-0.05em' }}>
            <span>{state.wins_red}</span>
            <span className="text-white/30 font-light">–</span>
            <span>{state.wins_white}</span>
          </div>

          {/* Blue side crests */}
          <div className="flex items-center justify-start gap-2 sm:gap-3">
            <MiniCrest side="white" code={teamCode(white.name)} />
            {whitePartner && <MiniCrest side="white" code={teamCode(whitePartner.name)} />}
          </div>
        </div>

        {/* Team names — two columns, compact */}
        <div className="grid grid-cols-2 gap-6 sm:gap-12">
          <HalftimeAllianceCol side="red"  team={red}   partner={redPartner}   />
          <HalftimeAllianceCol side="blue" team={white} partner={whitePartner} />
        </div>

        {/* Bottom hint */}
        <div className="mt-8 pt-4 border-t border-white/10 text-center text-white/40 text-[10px] sm:text-xs font-mono tracking-[0.3em] uppercase">
          ⏸ Fair play · 2nd half coming up
        </div>
      </div>
    </div>
  )
}

// Helper for HalftimeStage: alliance column with side label + 1 or 2 team names.
function HalftimeAllianceCol({ side, team, partner }: {
  side: 'red' | 'blue'
  team: TeamLite
  partner: TeamLite | null
}) {
  const isRed = side === 'red'
  const labelColor = isRed ? 'text-rose-300' : 'text-cyan-300'
  const labelGlow = isRed
    ? '0 0 16px rgba(244,63,94,0.4)'
    : '0 0 16px rgba(59,130,246,0.4)'
  const sideLabel = isRed ? 'RED' : 'BLUE'
  const align = isRed ? 'text-right items-end' : 'text-left items-start'

  return (
    <div className={`flex flex-col ${align} min-w-0`}>
      <div className={`${labelColor} font-black tracking-[0.5em] uppercase mb-2`}
        style={{
          fontSize: 'clamp(0.7rem, 1vw, 0.9rem)',
          textShadow: labelGlow,
        }}>
        {sideLabel}
      </div>
      <div className="text-white font-black uppercase leading-tight break-words"
        style={{ fontSize: 'clamp(1rem, 1.8vw, 1.6rem)' }}>
        {team.name}
      </div>
      {partner && (
        <div className="text-white/80 font-black uppercase leading-tight break-words mt-1"
          style={{ fontSize: 'clamp(1rem, 1.8vw, 1.6rem)' }}>
          {partner.name}
        </div>
      )}
    </div>
  )
}

// ── FULL-TIME / final result ──
function FullTimeStage({
  red, redPartner, white, whitePartner, state, winnerSide, matchId, eventWatermark,
}: {
  red: TeamLite
  redPartner: TeamLite | null
  white: TeamLite
  whitePartner: TeamLite | null
  state: LiveStateB
  winnerSide: 'red' | 'white' | 'draw' | null
  matchId: string
  eventWatermark: string
}) {
  const winnerTeam: TeamLite | null = winnerSide === 'red' ? red : winnerSide === 'white' ? white : null
  const winnerPartner: TeamLite | null = winnerSide === 'red' ? redPartner : winnerSide === 'white' ? whitePartner : null

  const isRedWin  = winnerSide === 'red'
  const isBlueWin = winnerSide === 'white'
  const isDraw    = winnerSide === 'draw'
  const accentText =
    isRedWin  ? 'text-rose-300'
  : isBlueWin ? 'text-cyan-300'
              : 'text-emerald-200'
  const winnerGlow =
    isRedWin  ? '0 0 30px rgba(244,63,94,0.4)'
  : isBlueWin ? '0 0 30px rgba(59,130,246,0.4)'
              : 'none'
  const accentStripe =
    isRedWin  ? 'linear-gradient(90deg, rgba(244,63,94,0) 0%, rgba(244,63,94,0.85) 50%, rgba(244,63,94,0) 100%)'
  : isBlueWin ? 'linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.85) 50%, rgba(59,130,246,0) 100%)'
              : 'linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.7) 50%, rgba(16,185,129,0) 100%)'

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 relative">
      {/* CHAMPIONSHIP CARD wrapper — subtle frame, premium feel */}
      <div className="relative border border-white/10 bg-black/35 backdrop-blur-md py-10 sm:py-14 px-6 sm:px-12"
        style={{ animation: 'sfrcScoreBugSlide 0.7s ease-out' }}>

        {/* Top accent stripe glowing in winner color */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: accentStripe }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: accentStripe }} />

        {/* corner serial — like a championship plaque numbering */}
        <div className="absolute top-3 left-4 text-white/35 font-mono text-[10px] sm:text-xs tracking-[0.3em]">
          № {matchId}
        </div>
        <div className="absolute top-3 right-4 text-white/35 font-mono text-[10px] sm:text-xs tracking-[0.3em]">
          {eventWatermark}
        </div>

        {/* tiny FT caption */}
        <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300/80 font-semibold tracking-[0.45em] uppercase"
            style={{ fontSize: 'clamp(0.65rem, 0.9vw, 0.8rem)' }}>
            FULL-TIME · Robo Football
          </span>
        </div>

        {/* WINNERS / DRAW label — quiet but distinct */}
        <div className="text-center mb-2 sm:mb-3">
          <span className={`font-black tracking-[0.5em] uppercase ${accentText}`}
            style={{
              fontSize: 'clamp(0.85rem, 1.4vw, 1.2rem)',
              letterSpacing: '0.5em',
              textShadow: winnerGlow,
            }}>
            {isDraw ? 'DRAW' : 'WINNER'}
          </span>
        </div>

        {/* HERO: winner team names HUGE (photo-worthy). One name per line so long names breathe. */}
        {!isDraw && winnerTeam && (
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-white font-black uppercase leading-[0.95] break-words"
              style={{
                fontSize: 'clamp(2.2rem, 6vw, 5.5rem)',
                letterSpacing: '-0.03em',
                textShadow: '0 4px 24px rgba(0,0,0,0.6)',
              }}>
              {winnerTeam.name}
            </div>
            {winnerPartner && (
              <>
                <div className={`${accentText} font-black my-2 sm:my-3`}
                  style={{
                    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                    textShadow: winnerGlow,
                  }}>
                  +
                </div>
                <div className="text-white font-black uppercase leading-[0.95] break-words"
                  style={{
                    fontSize: 'clamp(2.2rem, 6vw, 5.5rem)',
                    letterSpacing: '-0.03em',
                    textShadow: '0 4px 24px rgba(0,0,0,0.6)',
                  }}>
                  {winnerPartner.name}
                </div>
              </>
            )}
          </div>
        )}

        {/* SCORE row: crests on each side, big tabular score in middle.
            Both sides at full opacity (no shaming). Winner side score colored + glow, other side neutral white. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-10 my-6 sm:my-8">
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <MiniCrest side="red" code={teamCode(red.name)} />
            {redPartner && <MiniCrest side="red" code={teamCode(redPartner.name)} />}
          </div>

          <div className="font-black tabular-nums leading-none flex items-baseline gap-4 sm:gap-6 whitespace-nowrap"
            style={{ fontSize: 'clamp(4rem, 11vw, 9rem)', letterSpacing: '-0.05em' }}>
            <span className={isRedWin ? 'text-rose-300' : 'text-white'}
              style={{ textShadow: isRedWin ? '0 0 30px rgba(244,63,94,0.5)' : 'none' }}>
              {state.wins_red}
            </span>
            <span className="text-white/30 font-light">–</span>
            <span className={isBlueWin ? 'text-cyan-300' : 'text-white'}
              style={{ textShadow: isBlueWin ? '0 0 30px rgba(59,130,246,0.5)' : 'none' }}>
              {state.wins_white}
            </span>
          </div>

          <div className="flex items-center justify-start gap-2 sm:gap-3">
            <MiniCrest side="white" code={teamCode(white.name)} />
            {whitePartner && <MiniCrest side="white" code={teamCode(whitePartner.name)} />}
          </div>
        </div>

        {/* BOTTOM brand bar */}
        <div className="mt-8 sm:mt-10 pt-4 sm:pt-5 border-t border-white/10 flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-white/40 font-mono tracking-[0.3em] uppercase">⚽ SFRC · Robo Football</span>
          <span className="text-white/40 font-mono tracking-[0.3em] uppercase">Startup Fest Robotics Challenge</span>
        </div>
      </div>
    </div>
  )
}

// Small clean crest for the final-result row (smaller than main AllianceColumn crests).
function MiniCrest({ side, code }: { side: 'red' | 'white'; code: string }) {
  const isRed = side === 'red'
  const grad = isRed
    ? 'from-rose-500 via-red-600 to-red-800'
    : 'from-cyan-400 via-blue-600 to-blue-800'
  return (
    <div className={`relative rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg border border-white/20`}
      style={{
        width: 'clamp(2.5rem, 6vw, 5rem)',
        height: 'clamp(2.5rem, 6vw, 5rem)',
      }}>
      <span className="font-black tracking-[0.1em] text-white"
        style={{ fontSize: 'clamp(0.7rem, 1.4vw, 1.2rem)' }}>
        {code}
      </span>
    </div>
  )
}

// ── GOAL! flash overlay (full screen) ──
function GoalOverlay({ side, scoredBy }: { side: 'red' | 'white'; scoredBy: string | null }) {
  const isRed = side === 'red'
  const grad = isRed
    ? 'radial-gradient(ellipse at center, rgba(244,63,94,0.55), rgba(244,63,94,0.0) 60%)'
    : 'radial-gradient(ellipse at center, rgba(59,130,246,0.55), rgba(59,130,246,0.0) 60%)'
  const color = isRed ? 'text-white' : 'text-white'
  const glow = isRed
    ? '0 0 60px rgba(244,63,94,1), 0 0 160px rgba(244,63,94,0.7), 0 0 320px rgba(244,63,94,0.4)'
    : '0 0 60px rgba(59,130,246,1), 0 0 160px rgba(59,130,246,0.7), 0 0 320px rgba(59,130,246,0.4)'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
      {/* backdrop flash */}
      <div className="absolute inset-0" style={{ background: grad, animation: 'sfrcGoalBackdrop 1.2s ease-out' }} />
      {/* confetti */}
      <ConfettiBurst side={side} />
      {/* GOAL! text slam — `willChange` hints the compositor to promote this to
          its own GPU layer so the scale+rotate animation stays buttery-smooth. */}
      <div className={`relative font-black tracking-tight uppercase ${color}`}
        style={{
          fontSize: 'clamp(8rem, 22vw, 22rem)',
          letterSpacing: '-0.04em',
          textShadow: glow,
          animation: 'sfrcGoalSlam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform, opacity',
          transform: 'translateZ(0)',
        }}>
        GOAL!
      </div>
      {scoredBy && (
        <div className="relative mt-4 text-xl sm:text-3xl font-bold tracking-widest text-white/90"
          style={{ animation: 'sfrcKOSlam 0.7s ease-out 0.2s both' }}>
          Scored by <span className="font-black">{scoredBy}</span>
        </div>
      )}
    </div>
  )
}

function ConfettiBurst({ side }: { side: 'red' | 'white' }) {
  const colors = side === 'red'
    ? ['#f43f5e', '#fb923c', '#fbbf24', '#ffffff']
    : ['#3b82f6', '#06b6d4', '#a78bfa', '#ffffff']
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 16 }).map((_, i) => {
        const left = (i * 37 + 13) % 100
        const delay = (i * 0.08) % 2
        const dur = 2.4 + (i % 5) * 0.3
        const color = colors[i % colors.length]
        return (
          <span
            key={i}
            className="absolute top-0 w-2 h-3 rounded-sm"
            style={{
              willChange: 'transform, opacity',
              left: `${left}%`,
              background: color,
              animation: `sfrcConfettiDrop ${dur}s linear ${delay}s 1`,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Loading: we have active match id but teams/match data still fetching ──
function PitchLoading() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)',
        fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
      }}>
      <PitchPattern />
      <div className="relative z-10 text-emerald-300 font-black tracking-[0.45em] uppercase mb-6"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}>
        ⚽ Robo Football
      </div>
      <div className="relative z-10 text-emerald-100 font-black uppercase tracking-tight"
        style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
        Loading match data
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0s infinite', display: 'inline-block', marginLeft: '0.4em' }}>.</span>
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0.2s infinite', display: 'inline-block' }}>.</span>
        <span style={{ animation: 'sfrcSuspenseDots 1s ease-in-out 0.4s infinite', display: 'inline-block' }}>.</span>
      </div>
    </div>
  )
}

// ── Idle: pitch with next-match KICK-OFF preview ──
function PitchIdle({ next }: { next: NextMatch | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)',
        fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
      }}>
      <PitchPattern />

      <div className="relative z-10 text-emerald-300 font-black tracking-[0.45em] uppercase mb-6"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}>
        ⚽ Robo Football
      </div>

      {next && next.red && next.white ? (
        <>
          <div className="relative z-10 bg-amber-400/10 border-2 border-amber-400/60 px-6 sm:px-10 py-3 sm:py-4 mb-8 sm:mb-12"
            style={{ animation: 'sfrcBorderCycle 4s ease-in-out infinite' }}>
            <div className="text-amber-300 font-black tracking-[0.4em] uppercase text-center"
              style={{ fontSize: 'clamp(1rem, 2.4vw, 2rem)' }}>
              ⚡ KICK-OFF <span className="text-white/40 mx-2">·</span> <span className="font-mono">#{next.match_id}</span>
            </div>
          </div>
          <div className="relative z-10 grid grid-cols-[5fr_2fr_5fr] gap-4 sm:gap-8 items-center w-full max-w-7xl mx-auto px-6">
            <AllianceColumn side="red" team={next.red} partner={next.redPartner} />
            <div className="text-emerald-400 font-black text-center"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', animation: 'sfrcArcadeFlicker 2s linear infinite' }}>
              VS
            </div>
            <AllianceColumn side="white" team={next.white} partner={next.whitePartner} />
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 text-emerald-200 font-black uppercase tracking-tight text-center mb-3"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}>
            Awaiting kick-off
          </div>
          <div className="relative z-10 text-white/40 text-base sm:text-xl uppercase tracking-widest text-center">Pitch is clear · standby</div>
        </>
      )}
    </div>
  )
}

// ── Finals round-robin overlay (shown when judge enables Show Finals) ──
function FinalsOverlayD({ items }: { items: FinalsMatchD[] }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-auto"
      style={{
        background: 'linear-gradient(180deg, #0a3d1c 0%, #052010 50%, #02100a 100%)',
        fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
        padding: 'clamp(16px, 4vw, 48px)',
      }}
    >
      <PitchPattern />
      <div className="relative z-10 w-full" style={{ maxWidth: 680 }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="text-emerald-400 font-black tracking-[0.4em] uppercase"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.6rem)', animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}
          >
            ⚽ ROBO FOOTBALL · FINALS
          </div>
          <div className="text-emerald-300/40 text-[10px] font-mono tracking-widest uppercase mt-1">
            3-Alliance Round Robin
          </div>
        </div>

        {/* Bracket */}
        <FinalsBracketD matches={items} dark scale={1.05} />

        {/* Footer */}
        <div className="mt-6 text-center text-emerald-300/20 text-[10px] tracking-[0.4em] uppercase">
          SFRC · STARTUP FEST ROBOTICS CHALLENGE
        </div>
      </div>
    </div>
  )
}

// ── Decorative pitch pattern (lines + center circle, like a soccer field viewed from above) ──
function PitchPattern() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
      {/* horizontal stripe pattern (mowing direction) */}
      <div className="absolute inset-0"
        style={{
          background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 30px, transparent 30px 60px)',
        }}
      />
      {/* center circle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[28vmin] h-[28vmin] rounded-full border-2 border-emerald-400/30" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400/40" />
      {/* center vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-400/15" />
    </div>
  )
}
