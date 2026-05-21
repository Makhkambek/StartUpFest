'use client'
import type { ReactNode } from 'react'

// Shared championship/trophy card for field displays — the photo-worthy winner
// composition shown at match end. Modeled on category D's FullTimeStage so all
// categories share one brand (frame, serial, watermark, HUGE winner name) while
// each passes its own accent colour and result line (score / time / method).

export type TrophyAccent = 'red' | 'blue' | 'cyan' | 'magenta' | 'amber' | 'emerald'

const ACCENT: Record<TrophyAccent, { hex: string; glow: string }> = {
  red:     { hex: '#fb7185', glow: '0 0 30px rgba(244,63,94,0.5)' },
  blue:    { hex: '#60a5fa', glow: '0 0 30px rgba(59,130,246,0.5)' },
  cyan:    { hex: '#22d3ee', glow: '0 0 30px rgba(34,211,238,0.5)' },
  magenta: { hex: '#e879f9', glow: '0 0 30px rgba(232,121,249,0.5)' },
  amber:   { hex: '#f5c451', glow: '0 0 30px rgba(245,196,81,0.5)' },
  emerald: { hex: '#34d399', glow: '0 0 28px rgba(16,185,129,0.45)' },
}

// 2-4 letter code from a team name, e.g. "Robo Phoenix" → "RP", "Venom" → "VEN".
export function teamCode(name: string | null | undefined): string {
  if (!name) return '—'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return words[0].slice(0, 3).toUpperCase()
}

export function TrophyCrest({ accent, code }: { accent: TrophyAccent; code: string }) {
  const a = ACCENT[accent]
  return (
    <div
      className="grid place-items-center rounded-xl font-black tabular-nums"
      style={{
        width: 'clamp(2.6rem, 6vw, 5rem)',
        height: 'clamp(2.6rem, 6vw, 5rem)',
        fontSize: 'clamp(0.9rem, 2vw, 1.6rem)',
        color: '#fff',
        background: `linear-gradient(145deg, ${a.hex}33, rgba(0,0,0,0.5))`,
        border: `1px solid ${a.hex}66`,
        boxShadow: a.glow,
      }}
    >
      {code}
    </div>
  )
}

export default function TrophyCard({
  accent,
  serial,
  watermark,
  caption,
  label,
  winnerName,
  winnerPartner,
  children,
}: {
  accent: TrophyAccent
  serial: string
  watermark: string
  caption: string
  label: string
  winnerName: string
  winnerPartner?: string | null
  children: ReactNode // result line: score / time / method
}) {
  const a = ACCENT[accent]
  const stripe = `linear-gradient(90deg, ${a.hex}00 0%, ${a.hex}d9 50%, ${a.hex}00 100%)`

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 relative">
      <div
        className="relative border border-white/10 bg-black/35 backdrop-blur-md py-10 sm:py-14 px-6 sm:px-12"
        style={{ animation: 'sfrcScoreBugSlide 0.7s ease-out' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: stripe }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: stripe }} />

        <div className="absolute top-3 left-4 text-white/35 font-mono text-[10px] sm:text-xs tracking-[0.3em]">
          № {serial}
        </div>
        <div className="absolute top-3 right-4 text-white/35 font-mono text-[10px] sm:text-xs tracking-[0.3em]">
          {watermark}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: a.hex }} />
          <span
            className="font-semibold tracking-[0.45em] uppercase"
            style={{ fontSize: 'clamp(0.65rem, 0.9vw, 0.8rem)', color: `${a.hex}cc` }}
          >
            {caption}
          </span>
        </div>

        <div className="text-center mb-2 sm:mb-3">
          <span
            className="font-black uppercase"
            style={{ fontSize: 'clamp(0.85rem, 1.4vw, 1.2rem)', letterSpacing: '0.5em', color: a.hex, textShadow: a.glow }}
          >
            {label}
          </span>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <div
            className="text-white font-black uppercase leading-[0.95] break-words"
            style={{ fontSize: 'clamp(2.2rem, 6vw, 5.5rem)', letterSpacing: '-0.03em', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
          >
            {winnerName}
          </div>
          {winnerPartner && (
            <>
              <div className="font-black my-2 sm:my-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: a.hex, textShadow: a.glow }}>
                +
              </div>
              <div
                className="text-white font-black uppercase leading-[0.95] break-words"
                style={{ fontSize: 'clamp(2.2rem, 6vw, 5.5rem)', letterSpacing: '-0.03em', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
              >
                {winnerPartner}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-10 my-2">{children}</div>
      </div>
    </div>
  )
}
