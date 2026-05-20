'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useEventSettings } from '@/lib/use-event-settings'
import type { LiveStateB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

interface TeamLite {
  id: string
  name: string | null
  school: string | null
}

interface LeaderRow {
  rank: number
  name: string
  school: string
  time: number | null
  penalty: string
}

interface NextRun {
  match_id: string
  status: ScheduledMatch['status']
  team: TeamLite | null
  bestTime: number | null
}

interface FieldStateA {
  state: LiveStateB
  match: ScheduledMatch | null
  team: TeamLite | null
  bestTime: number | null
  leaderboard: LeaderRow[]
  nextRun: NextRun | null
}

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COUNTDOWN_SECONDS = 5

// Local-clock count-up. Starts from 00:00 when `active` flips true (no clock-drift dependency),
// FREEZES on the last value when `active` flips false (so round_result keeps showing the final
// time on /field/a), and resets to 0 when `active` flips true again.
function useLiveTimer(active: boolean) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    if (!active) return // keep last value — visual freeze
    const start = Date.now()
    setMs(0)
    const id = setInterval(() => setMs(Date.now() - start), 30)
    return () => clearInterval(id)
  }, [active])
  return ms
}

// Countdown rebased to the moment this effect fires (= moment client sees phase=countdown).
// Fresh anchor every time so a brand-new match always starts from 5 — no stale state.
function useCountdown(startedAt: string | null, isCountdown: boolean) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!isCountdown || !startedAt) { setRemaining(null); return }
    const localStart = Date.now()
    setRemaining(COUNTDOWN_SECONDS)
    const tick = () => {
      const r = COUNTDOWN_SECONDS - (Date.now() - localStart) / 1000
      setRemaining(r > 0 ? r : 0)
    }
    const id = setInterval(tick, 60)
    return () => clearInterval(id)
  }, [startedAt, isCountdown])

  return remaining
}

// Track how long the current phase has been active (used to fade overlays).
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

function formatTime(ms: number): string {
  const totalSec = ms / 1000
  const mm = Math.floor(totalSec / 60)
  const ss = Math.floor(totalSec) % 60
  const cs = Math.floor((ms % 1000) / 10)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function formatSec(s: number): string {
  const mm = Math.floor(s / 60)
  const ss = s - mm * 60
  if (mm === 0) return ss.toFixed(2) + 's'
  return `${mm}:${String(Math.floor(ss)).padStart(2, '0')}.${String(Math.floor((ss % 1) * 100)).padStart(2, '0')}`
}

export default function FieldAClient() {
  const t = useTranslations('field.a')
  const locale = useLocale() as 'en' | 'ru' | 'uz'
  const { watermark: eventWatermark } = useEventSettings(locale)
  const [data, setData] = useState<FieldStateA | null>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/field/a/state', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {}
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Always poll (safety net even in Supabase mode — if realtime publication isn't set up).
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
      channel = supabase.channel(`field-a-${Date.now()}`)
      for (const table of ['live_match_state', 'scheduled_matches', 'teams', 'results_a']) {
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

  if (!data) return <BootScreen />
  return <ArcadeView data={data} t={t} eventWatermark={eventWatermark} />
}

// ───────────────────────────────────────────────────────────────────────
//   ARCADE VIEW — RotorHazard / underground FPV race aesthetic
// ───────────────────────────────────────────────────────────────────────

function BootScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#020308]" style={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace' }}>
      <div className="text-cyan-400 text-2xl tracking-[0.4em]" style={{ animation: 'sfrcArcadeFlicker 2s linear infinite' }}>
        » LOADING RACE «
      </div>
    </div>
  )
}

const MATCH_RESULT_DISPLAY_MS = 5000

function ArcadeView({ data, t, eventWatermark }: { data: FieldStateA; t: ReturnType<typeof useTranslations>; eventWatermark: string }) {
  const { state, match, team, bestTime, leaderboard, nextRun } = data
  const isRunning = state.phase === 'fighting'
  const isCountdown = state.phase === 'countdown'
  const isReady = state.phase === 'waiting' || state.phase === 'positioning'
  const isFinished = state.phase === 'round_result'
  const isMatchOver = state.phase === 'match_result'

  const cdRemaining = useCountdown(state.countdown_started_at, isCountdown)
  // Timer becomes "active" the instant the visible countdown reaches 0, OR when phase
  // is already 'fighting' (judge pressed GO without countdown). Decouples timer-start
  // from the server phase flip so no latency-related "stuck on 0".
  const countdownFinished = isCountdown && cdRemaining !== null && cdRemaining <= 0
  const timerActive = isRunning || countdownFinished
  const liveMs = useLiveTimer(timerActive)
  const phaseElapsed = usePhaseElapsed(state.phase)

  // Last attempt's time from round_history (jsonb of {time: number|null}).
  const lastRunTime: number | null = (() => {
    const raw = (state.round_history as unknown) ?? []
    if (!Array.isArray(raw) || raw.length === 0) return null
    const last = raw[raw.length - 1]
    if (typeof last === 'number') return last
    if (last && typeof last === 'object' && typeof (last as { time?: number }).time === 'number') {
      return (last as { time: number }).time
    }
    return null
  })()

  const matchLabel = match ? `MATCH ${match.match_id}` : 'STANDBY'
  // Pull the numeric part of the match id (Q-3 → 3, TEST-B1 → 1) for the track channel label.
  const channelNum = match ? (match.match_id.match(/\d+/)?.[0] ?? '01') : '—'
  const channel = match ? `TRK-${channelNum}` : '—'

  return (
    <div
      className="h-screen w-screen overflow-hidden relative text-cyan-100 select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #061025 0%, #02050e 60%, #000204 100%)',
        fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
      }}
    >
      <CrtScanlines />
      <GridFloor />

      {/* ── TOP TICKER ── */}
      <header className="relative z-20 px-6 sm:px-10 py-3 flex items-center justify-between border-b border-cyan-400/25 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="text-cyan-300" style={{ animation: 'sfrcArcadeFlicker 4s linear infinite' }}>◆</span>
          <span
            className="text-cyan-200 text-xs sm:text-sm font-black tracking-[0.45em] uppercase"
            style={{ animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}
          >
            {matchLabel}
          </span>
          <span className="text-cyan-300">◆</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-pink-400/80 text-xs font-black tracking-[0.35em] uppercase">
            HEAT · {state.round_number || 1}
          </span>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-10 h-[calc(100vh-3.5rem-2.25rem)] grid grid-cols-12">
        {/* Center pilot card */}
        <section className="col-span-12 lg:col-span-8 flex flex-col items-center justify-center px-6 sm:px-12 text-center">
          {/* After match ends, show the result for ~5s then fall through to "on deck" */}
          {isMatchOver && phaseElapsed > MATCH_RESULT_DISPLAY_MS && nextRun?.team ? (
            <ArcadeOnDeck next={nextRun} t={t} />
          ) : isMatchOver && phaseElapsed > MATCH_RESULT_DISPLAY_MS ? (
            <ArcadeIdle t={t} />
          ) : null}
          {(!isMatchOver || phaseElapsed <= MATCH_RESULT_DISPLAY_MS) && !team && !nextRun?.team && <ArcadeIdle t={t} />}
          {(!isMatchOver || phaseElapsed <= MATCH_RESULT_DISPLAY_MS) && !team && nextRun?.team && <ArcadeOnDeck next={nextRun} t={t} />}
          {team && (!isMatchOver || phaseElapsed <= MATCH_RESULT_DISPLAY_MS) && (
            <ArcadeRunner
              team={team}
              bestTime={bestTime}
              lastRunTime={lastRunTime}
              fouls={state.fouls_red}
              attempt={state.round_number}
              liveMs={liveMs}
              cdRemaining={cdRemaining}
              timerActive={timerActive}
              phaseElapsed={phaseElapsed}
              isCountdown={isCountdown}
              isReady={isReady}
              isFinished={isFinished}
              isMatchOver={isMatchOver}
              channel={channel}
              t={t}
            />
          )}
        </section>

        {/* Right leaderboard rail */}
        <aside className="hidden lg:flex col-span-4 flex-col border-l border-cyan-400/20 bg-black/40 backdrop-blur-sm">
          <Leaderboard rows={leaderboard} currentTeamId={team?.id ?? null} t={t} />
        </aside>
      </main>

      {/* ── BOTTOM TICKER ── */}
      <BottomTicker channel={channel} state={state} t={t} matchId={match?.match_id ?? null} eventWatermark={eventWatermark} />
    </div>
  )
}

// ── Pilot center card during active run ──
function ArcadeRunner({
  team, bestTime, lastRunTime, fouls, attempt, liveMs, cdRemaining, timerActive, phaseElapsed,
  isCountdown, isReady, isFinished, isMatchOver,
  channel, t,
}: {
  team: TeamLite
  bestTime: number | null
  lastRunTime: number | null
  fouls: number
  attempt: number
  liveMs: number
  cdRemaining: number | null
  timerActive: boolean
  phaseElapsed: number
  isCountdown: boolean
  isReady: boolean
  isFinished: boolean
  isMatchOver: boolean
  channel: string
  t: ReturnType<typeof useTranslations>
}) {
  void channel
  const penaltySec = fouls === 0 ? 0 : fouls === 1 ? 20 : 40

  // Showing countdown digits (5..4..3..2..1) — only while remaining > 0.
  const inCountdownDigits = isCountdown && cdRemaining !== null && cdRemaining > 0

  // The label shows "GO!" for the first ~1.2s of timer-active, then "LIVE" for the rest.
  // We use liveMs (which resets to 0 when timerActive flips on) as the local trigger,
  // so no dependency on server phase events.
  const showGoLabel = timerActive && liveMs < 1200

  // What goes in the giant central readout
  let bigText = '--:--.--'
  let bigColor = 'text-cyan-300/40'
  let subLabel = ''
  if (inCountdownDigits) {
    bigText = `${Math.ceil(cdRemaining!)}`
    bigColor = 'text-amber-300'
    subLabel = '>> GET READY <<'
  } else if (timerActive) {
    bigText = formatTime(liveMs)
    bigColor = showGoLabel ? 'text-pink-400' : 'text-cyan-300'
    subLabel = showGoLabel ? '>> GO! <<' : '>> LIVE <<'
  } else if (isFinished) {
    // FREEZE on the local timer value — judge's view + audience see the same number stop.
    // (Server may store a slightly different time_sec from judge's local measurement —
    //  judge corrects via Edit later if needed.)
    if (lastRunTime === null) {
      bigText = 'DNF'
      bigColor = 'text-pink-400'
    } else {
      bigText = formatTime(liveMs)
      bigColor = 'text-emerald-300'
    }
    subLabel = `>> RUN ${attempt} DONE <<`
  } else if (isMatchOver) {
    bigText = bestTime !== null ? formatSec(bestTime) : '--:--.--'
    bigColor = 'text-emerald-300'
    subLabel = '>> COMPLETE <<'
  } else if (isReady) {
    bigText = 'READY'
    bigColor = 'text-amber-200'
    subLabel = '>> ON DECK <<'
  }

  const frameAccent =
    showGoLabel ? 'amber'
    : timerActive ? 'cyan'
    : inCountdownDigits ? 'amber'
    : isFinished || isMatchOver ? 'green'
    : 'mute'
  void phaseElapsed

  // Glow per phase
  const textShadow =
    showGoLabel
      ? '0 0 24px rgba(236,72,153,1), 0 0 60px rgba(236,72,153,0.7), 0 0 120px rgba(236,72,153,0.4)'
      : timerActive
      ? '0 0 12px rgba(34,211,238,0.9), 0 0 36px rgba(34,211,238,0.6), 0 0 80px rgba(34,211,238,0.4)'
      : inCountdownDigits
      ? '0 0 16px rgba(245,158,11,1), 0 0 48px rgba(245,158,11,0.6)'
      : isFinished || isMatchOver
      ? '0 0 12px rgba(110,231,183,0.9), 0 0 36px rgba(110,231,183,0.6)'
      : 'none'

  return (
    <div className="w-full max-w-4xl relative">
      {/* Pilot card */}
      <div className="mb-6">
        <div className="text-pink-400 text-xs sm:text-sm font-black tracking-[0.4em] uppercase mb-1">
          {'>> PILOT'}
        </div>
        <div
          className="text-5xl sm:text-7xl xl:text-8xl font-black tracking-tight leading-none uppercase text-cyan-100"
          style={{ animation: 'sfrcGlitch 7s linear infinite, sfrcArcadeFlicker 9s linear infinite' }}
        >
          {team.name ?? '—'}
        </div>
        {team.school && (
          <div className="text-cyan-300/60 text-sm sm:text-base mt-1 tracking-wider">{team.school}</div>
        )}
      </div>

      {/* HUGE timer in ASCII-frame — single source for both countdown digits & live timer */}
      <AsciiFrame accent={frameAccent} labelTop={subLabel} labelPulse={showGoLabel}>
        <div
          className={`font-black tabular-nums ${bigColor} mx-auto`}
          style={{
            fontSize: 'clamp(2.5rem, 11vw, 9rem)',
            lineHeight: 1.25,
            letterSpacing: '-0.03em',
            textShadow,
            animation: showGoLabel
              ? 'sfrcArcadeFlicker 1.2s linear infinite'
              : timerActive
              ? 'sfrcArcadeFlicker 4s linear infinite'
              : undefined,
          }}
        >
          {bigText}
        </div>
      </AsciiFrame>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4 text-center">
        <StatCell label=">> ATTEMPT <<" value={`${attempt} / 2`} accent="cyan" />
        <StatCell label=">> BEST <<" value={bestTime !== null ? formatSec(bestTime) : '—'} accent="cyan" />
        <StatCell
          label=">> PENALTY <<"
          value={penaltySec > 0 ? `+${penaltySec}s` : t('noPenalty')}
          accent={penaltySec > 0 ? 'amber' : 'mute'}
        />
      </div>
    </div>
  )
}

// ── On-deck preview when judge sets matches to "waiting" ──
function ArcadeOnDeck({ next, t }: { next: NextRun; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="text-center">
      <div className="text-pink-400 text-xs sm:text-sm font-black tracking-[0.4em] uppercase mb-2">
        {'»» ON DECK ««'}
      </div>
      <div className="text-amber-300/80 text-xs font-mono tracking-widest mb-4">#{next.match_id}</div>
      <div
        className="text-5xl sm:text-7xl font-black tracking-tight leading-none uppercase text-cyan-200 mb-3"
        style={{ animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}
      >
        {next.team?.name ?? '—'}
      </div>
      {next.team?.school && (
        <div className="text-cyan-300/60 text-base">{next.team.school}</div>
      )}
      {next.bestTime !== null && (
        <div className="mt-6 inline-flex items-baseline gap-3 px-5 py-2 bg-black/60 border border-cyan-400/30">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-300/50">{t('bestTime')}</span>
          <span className="font-mono text-cyan-300 text-2xl sm:text-3xl">{formatSec(next.bestTime)}</span>
        </div>
      )}
      <div className="mt-8 text-cyan-300/30 text-xs tracking-widest" style={{ animation: 'sfrcArcadeFlicker 2.5s linear infinite' }}>
        » INSERT COIN TO START «
      </div>
    </div>
  )
}

function ArcadeIdle({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="text-center">
      <div className="text-cyan-400/30 text-xs font-black tracking-[0.5em] uppercase mb-4">{t('title')}</div>
      <div
        className="text-5xl sm:text-7xl font-black tracking-tight text-cyan-300/70 mb-3"
        style={{ animation: 'sfrcArcadeFlicker 3s linear infinite' }}
      >
        » {t('noMatchActive')} «
      </div>
      <div className="text-cyan-300/40 text-base tracking-wider">{t('noMatchHint')}</div>
    </div>
  )
}

// ── Leaderboard rail ──
function Leaderboard({
  rows, currentTeamId, t,
}: {
  rows: LeaderRow[]
  currentTeamId: string | null
  t: ReturnType<typeof useTranslations>
}) {
  void currentTeamId
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-cyan-400/30 flex items-center justify-between">
        <span className="text-pink-400 text-xs font-black tracking-[0.4em] uppercase"
          style={{ animation: 'sfrcMagentaPulse 3s ease-in-out infinite' }}>
          »LEADERBOARD«
        </span>
        <span className="text-cyan-300/40 text-[10px] font-mono">TOP·{rows.length || 0}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-cyan-300/30 text-xs tracking-widest">
            » {t('noResultsYet')} «
          </div>
        ) : (
          <ul className="divide-y divide-cyan-400/10 font-mono">
            {rows.map((r) => (
              <li key={r.rank} className="px-4 py-3 flex items-center gap-3">
                <span className={`w-7 text-center text-sm font-black ${
                  r.rank === 1 ? 'text-amber-300' : r.rank === 2 ? 'text-cyan-200' : r.rank === 3 ? 'text-pink-300' : 'text-cyan-300/40'
                }`}>
                  #{r.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-cyan-100 truncate uppercase tracking-wide">{r.name}</div>
                  {r.school && <div className="text-[10px] text-cyan-300/40 truncate">{r.school}</div>}
                </div>
                <div className={`text-xs sm:text-sm font-black tabular-nums ${r.rank === 1 ? 'text-amber-300' : 'text-cyan-200'}`}>
                  {r.time !== null ? formatSec(r.time) : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Bottom marquee ticker ──
function BottomTicker({
  channel, state, t, matchId, eventWatermark,
}: {
  channel: string
  state: LiveStateB
  t: ReturnType<typeof useTranslations>
  matchId: string | null
  eventWatermark: string
}) {
  const status =
    state.phase === 'fighting' ? t('trackLive')
    : state.phase === 'countdown' ? t('trackArmed')
    : state.phase === 'waiting' || state.phase === 'positioning' ? t('ready')
    : t('trackClear')

  const dot =
    state.phase === 'fighting' ? 'bg-pink-400' :
    state.phase === 'countdown' ? 'bg-amber-300' :
    state.phase === 'waiting' || state.phase === 'positioning' ? 'bg-cyan-300' :
    'bg-white/30'

  const ticker = `» SFRC · STARTUP FEST ROBOTICS CHALLENGE · ${eventWatermark} · LINE FOLLOWER ·${matchId ? ` MATCH ${matchId} ·` : ''} `

  return (
    <footer className="absolute bottom-0 inset-x-0 z-20 h-9 flex items-center border-t border-cyan-400/25 bg-black/80 backdrop-blur-sm px-4 sm:px-8 gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <span className={`w-2 h-2 rounded-full ${dot}`} style={{ animation: 'sfrcLive 1.1s ease-in-out infinite' }} />
        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-200">
          {t('trackStatus')} {channel} · {status}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex whitespace-nowrap text-[10px] tracking-widest text-cyan-300/40 font-mono"
          style={{ animation: 'sfrcMarquee 38s linear infinite' }}>
          <span>{ticker.repeat(4)}</span>
          <span>{ticker.repeat(4)}</span>
        </div>
      </div>
    </footer>
  )
}

// ── Decorative: ASCII frame around content ──
function AsciiFrame({
  children, accent, labelTop, labelPulse,
}: {
  children: React.ReactNode
  accent: 'cyan' | 'amber' | 'green' | 'mute'
  labelTop?: string
  labelPulse?: boolean
}) {
  const borderColor =
    accent === 'cyan' ? 'border-cyan-400/55'
    : accent === 'amber' ? 'border-amber-400/55'
    : accent === 'green' ? 'border-emerald-400/55'
    : 'border-cyan-400/20'

  const cornerColor =
    accent === 'cyan' ? 'text-cyan-300'
    : accent === 'amber' ? 'text-amber-300'
    : accent === 'green' ? 'text-emerald-300'
    : 'text-cyan-400/40'

  return (
    <div className="relative pt-5 sm:pt-6">
      {labelTop && (
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 px-3 bg-[#02050e] text-base sm:text-xl font-black tracking-[0.4em] z-10 ${labelPulse ? 'text-pink-400' : cornerColor}`}
          style={labelPulse
            ? { textShadow: '0 0 12px rgba(236,72,153,0.95), 0 0 36px rgba(236,72,153,0.5)', animation: 'sfrcArcadeFlicker 1.2s linear infinite' }
            : undefined}
        >
          {labelTop}
        </div>
      )}
      <div className={`relative border-2 ${borderColor} px-4 py-8 sm:px-6 sm:py-12 bg-black/30 overflow-hidden`}
        style={{ animation: accent === 'mute' ? 'sfrcBorderCycle 6s ease-in-out infinite' : undefined }}>
        {/* corner brackets */}
        <span className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 ${borderColor.replace('/55', '')}`} />
        <span className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 ${borderColor.replace('/55', '')}`} />
        <span className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 ${borderColor.replace('/55', '')}`} />
        <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 ${borderColor.replace('/55', '')}`} />
        <div className="text-center w-full">{children}</div>
      </div>
    </div>
  )
}

function StatCell({
  label, value, accent,
}: {
  label: string
  value: string
  accent: 'cyan' | 'amber' | 'mute'
}) {
  const color =
    accent === 'cyan' ? 'text-cyan-200' :
    accent === 'amber' ? 'text-amber-300' :
    'text-cyan-300/40'
  return (
    <div className="border border-cyan-400/15 bg-black/30 px-3 py-2 sm:py-3">
      <div className="text-[9px] sm:text-[11px] font-black tracking-[0.3em] uppercase text-pink-400/70 mb-1">{label}</div>
      <div className={`font-mono font-black tabular-nums ${color} text-lg sm:text-2xl`}>{value}</div>
    </div>
  )
}

// ── Background layers ──
function CrtScanlines() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-30"
      style={{
        backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
      }}
    />
  )
}

function GridFloor() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Horizontal scanline grid */}
      <div className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(to right, rgba(34,211,238,0.4) 0 1px, transparent 1px 64px),' +
            'repeating-linear-gradient(to bottom, rgba(34,211,238,0.4) 0 1px, transparent 1px 64px)',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
      {/* Magenta glow accent */}
      <div className="absolute -top-32 right-1/4 w-[30vmax] h-[30vmax] rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 w-[25vmax] h-[25vmax] rounded-full bg-cyan-400/10 blur-3xl" />
    </div>
  )
}
