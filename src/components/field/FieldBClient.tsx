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

interface FieldState {
  state: LiveStateB
  match: ScheduledMatch | null
  red: TeamLite | null
  white: TeamLite | null
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
  const t = useTranslations('field.b')
  const [data, setData] = useState<FieldState | null>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/field/b/state', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {}
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Always poll (safety net for Supabase realtime).
  useEffect(() => {
    const id = setInterval(refetch, hasSupabase ? 1500 : 1500)
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

  if (!data) return <Splash label={t('title')} />
  return <Scoreboard data={data} />
}

function Splash({ label }: { label: string }) {
  return (
    <div className="h-screen flex items-center justify-center text-white/30 text-2xl tracking-widest uppercase">
      {label} ·  loading…
    </div>
  )
}

function Scoreboard({ data }: { data: FieldState }) {
  const t = useTranslations('field.b')
  const locale = useLocale() as 'en' | 'ru' | 'uz'
  const { settings: eventSettings, cityName: eventCity } = useEventSettings(locale)
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
            {t('matchResults')}
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
                {state.round_number > 3 ? t('goldenMatch') : t('roundOf', { n: state.round_number, total })}
              </div>
              <div className="font-black text-base sm:text-lg tracking-tight flex items-baseline gap-3 justify-center">
                <span>{t('matchPrefix')} {match!.match_id}</span>
                {state.phase === 'fighting' && (
                  <span className="font-mono tabular-nums text-amber-400 text-lg sm:text-2xl">{matchTimer}</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-black tracking-[0.3em] uppercase">
          🤼 {t('title')}
        </div>
      </header>

      {/* ── Idle ── */}
      {!hasMatch && (
        <section className="relative flex-1 flex flex-col items-center justify-center text-center px-8 z-10">
          <div className="text-amber-400/70 text-xs font-black tracking-[0.4em] uppercase mb-4">{t('title')}</div>
          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent mb-6" />
          <div className="text-5xl sm:text-7xl font-black tracking-tight mb-3" style={{ animation: 'sfrcGlow 3s ease-in-out infinite' }}>
            {t('noMatchActive')}
          </div>
          <div className="text-white/40 text-lg">{t('noMatchHint')}</div>
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
                background: 'linear-gradient(70deg, #e5e7eb 0%, #f3f4f6 60%, #ffffff 100%)',
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

            {/* White side */}
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
            <CenterOverlay state={state} remaining={remaining} winnerSide={winnerSide} phaseElapsed={phaseElapsed} matchTimer={matchTimer} />
          </div>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="shrink-0 px-6 sm:px-10 py-2.5 flex items-center justify-between border-t border-white/10 bg-black/40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-400 rounded flex items-center justify-center font-black text-[8px] text-gray-900 tracking-widest">SFRC</div>
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase text-white/70">
            Startup Fest Robotics Challenge · {eventSettings.year}
          </span>
        </div>
        <div className="text-[10px] sm:text-xs text-white/40 font-mono">
          {hasMatch ? `${eventCity} · ${t('title')}` : '—'}
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
  const t = useTranslations('field.b')
  const isRed = side === 'red'
  const textPrimary = isRed ? 'text-white' : 'text-gray-900'
  const textMuted = isRed ? 'text-white/60' : 'text-gray-600'
  const sideLabel = isRed ? t('red') : t('white')

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
        <span className="text-2xl">{isRed ? '🔴' : '⚪'}</span>
        <span className={`text-xs sm:text-sm font-black tracking-[0.3em] uppercase ${isRed ? 'text-white/70' : 'text-gray-600'}`}>
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
          {t('roundWins')}
        </div>
        {fouls > 0 && (
          <div className={`mt-3 text-xs font-bold tracking-widest ${isRed ? 'text-amber-300' : 'text-amber-600'}`}>
            {fouls} {t('fouls').toUpperCase()}
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
          <span className="text-xs font-black tracking-[0.25em] uppercase">{t('winnerBadge')}</span>
        </div>
      )}
    </div>
  )
}

function BreakdownTable({ state }: { state: LiveStateB }) {
  const t = useTranslations('field.b')
  const positionLabel = state.starting_position
    ? state.starting_position === 'face' ? t('positionFace')
      : state.starting_position === 'side' ? t('positionSide')
      : t('positionBack')
    : '—'

  type Row = { label: string; red: React.ReactNode; white: React.ReactNode; center: React.ReactNode | null }
  const rows: Row[] = [
    { label: t('position').toUpperCase(), red: positionShort(state.starting_position), white: positionShort(state.starting_position), center: positionLabel },
    { label: t('fouls').toUpperCase(),    red: state.fouls_red,                       white: state.fouls_white,                       center: null },
    { label: t('history').toUpperCase(),  red: historyCount(state.round_history, 'red'), white: historyCount(state.round_history, 'white'), center: historyDots(state.round_history) },
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
        <span key={i} className={`inline-block w-2 h-2 rounded-full ${h === 'red' ? 'bg-red-500' : h === 'white' ? 'bg-gray-200' : 'bg-amber-400'}`} />
      ))}
    </div>
  )
}

function CenterOverlay({
  state, remaining, winnerSide, phaseElapsed, matchTimer,
}: {
  state: LiveStateB
  remaining: number | null
  winnerSide: 'red' | 'white' | 'draw' | null
  phaseElapsed: number
  matchTimer: string
}) {
  const t = useTranslations('field.b')

  // Countdown always shown in full while we're in countdown phase.
  if (state.phase === 'countdown' && remaining !== null) {
    const isGo = remaining <= 0.2
    const big = isGo ? t('go') : Math.ceil(remaining).toString()
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="bg-black/85 backdrop-blur-md rounded-3xl px-12 py-8 border-2 border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.4)]">
          <div className="text-amber-400 text-xs font-black tracking-[0.4em] uppercase text-center mb-2">{t('phaseCountdownLabel')}</div>
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
            {t('go')}
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

  // Round result overlay — Yuhkoh shown 2.5s.
  if (state.phase === 'round_result' && phaseElapsed < ROUND_OVERLAY_MS) {
    const w = state.last_round_winner
    if (w === 'draw') {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-black/85 rounded-2xl px-10 py-6 border-2 border-amber-400 animate-[sfrcStart_0.35s_ease-out]">
            <div className="font-black text-amber-400 text-5xl sm:text-7xl">🟰 {t('draw')}</div>
          </div>
        </div>
      )
    }
    const side = w === 'red' ? t('red') : t('white')
    const color = w === 'red' ? 'text-red-400' : 'text-white'
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="bg-black/85 rounded-2xl px-10 py-6 border-2 border-amber-400 animate-[sfrcStart_0.35s_ease-out]">
          <div className={`font-black text-3xl sm:text-5xl ${color}`}>{t('yuhkohBy', { side })}</div>
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
            <div className="font-black text-amber-400 text-5xl sm:text-7xl text-center">🟰 {t('matchDraw')}</div>
          </div>
        </div>
      )
    }
    const winColor = winnerSide === 'red' ? 'text-red-400' : 'text-gray-100'
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="relative animate-[sfrcWinner_0.7s_ease-out]">
          {/* glow halo */}
          <div className="absolute inset-0 rounded-3xl bg-amber-400/20 blur-3xl animate-[sfrcGlow_1.6s_ease-in-out_infinite] -z-10" />
          {/* sparkles flying outward */}
          <Sparkles />
          <div className="bg-black/90 backdrop-blur-md rounded-3xl px-16 py-12 border-4 border-amber-400 shadow-[0_0_120px_rgba(245,158,11,0.6)] text-center">
            <div className="flex items-center justify-center gap-4 text-amber-400 text-xl sm:text-2xl font-black tracking-[0.35em] uppercase mb-3">
              <span className="text-3xl sm:text-4xl">🏆</span>
              {t('winnerBadge')}
            </div>
            <div className={`font-black tracking-tight ${winColor} leading-none`} style={{ fontSize: 'clamp(4rem, 11vw, 9rem)' }}>
              {winnerSide === 'red' ? t('red') : t('white')}
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
