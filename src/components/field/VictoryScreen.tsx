'use client'

const CONFETTI_COLORS = [
  '#fbbf24', '#f59e0b', '#fde68a', '#fff', '#fcd34d',
  '#fdba74', '#e879f9', '#a78bfa', '#34d399', '#fb7185',
  '#f97316', '#22d3ee', '#facc15', '#c084fc',
]

// 150 pieces — bigger, wider drift, varied speed
const PIECES = Array.from({ length: 150 }, (_, i) => ({
  left:     ((i * 137 + 17) % 100),
  delay:    ((i * 0.11) % 4.2),
  duration: 2.0 + ((i * 0.09) % 3.0),   // 2–5s
  size:     8 + ((i * 5) % 18),           // 8–25px
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  skew:     ((i * 29) % 40) - 20,
  drift:    ((i * 73) % 160) - 80,        // ±80px
}))

// Confetti-only overlay — transparent background, just falling pieces
export function ConfettiRain() {
  return (
    <div aria-hidden className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes sfrcConfettiFall {
          0%   { transform: translateY(-120px) translateX(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {PIECES.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-12px',
            left: `${p.left}%`,
            width:  p.size,
            height: p.size * 0.55,
            background: p.color,
            borderRadius: 2,
            transform: `skewX(${p.skew}deg)`,
            animationName: 'sfrcConfettiFall',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

// Golden aura: screen-edge glow + floating trophy badge above the result card
export function GrandFinalAura() {
  return (
    <div aria-hidden className="fixed inset-0 z-[55] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes sfrcAuraPulse {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }
        @keyframes sfrcTrophyFloat {
          0%,100% { transform: translateY(0)    scale(1);    filter: drop-shadow(0 0 24px rgba(251,191,36,0.9)); }
          50%     { transform: translateY(-14px) scale(1.12); filter: drop-shadow(0 0 56px rgba(251,191,36,1)); }
        }
        @keyframes sfrcBadgeFadeIn {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sfrcChampionTextGlow {
          0%,100% { text-shadow: 0 0 16px rgba(251,191,36,0.6), 0 0 40px rgba(251,191,36,0.3); }
          50%     { text-shadow: 0 0 32px rgba(251,191,36,1),   0 0 80px rgba(251,191,36,0.6); }
        }
      `}</style>

      {/* Screen-edge amber glow — 4-sided inset box-shadow */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 120px 40px rgba(251,191,36,0.22)',
          animation: 'sfrcAuraPulse 2.2s ease-in-out infinite',
        }}
      />

      {/* Trophy + "GRAND CHAMPION" badge — positioned at ~18 vh, centred */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{
          top: '18vh',
          animation: 'sfrcBadgeFadeIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Trophy emoji */}
        <div
          style={{
            fontSize: 'clamp(3.5rem, 10vw, 6.5rem)',
            lineHeight: 1,
            animation: 'sfrcTrophyFloat 2.6s ease-in-out infinite',
          }}
        >
          🏆
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: 'clamp(0.7rem, 1.6vw, 1rem)',
            fontWeight: 800,
            letterSpacing: '0.45em',
            color: '#fbbf24',
            fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif',
            animation: 'sfrcChampionTextGlow 2.2s ease-in-out infinite',
          }}
        >
          GRAND&nbsp;CHAMPION
        </div>
      </div>
    </div>
  )
}

interface Props {
  teamName: string
}

export default function VictoryScreen({ teamName }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1200 0%, #0a0800 40%, #000 100%)' }}
    >
      <style>{`
        @keyframes sfrcConfettiFall {
          0%   { transform: translateY(-120px) translateX(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
        @keyframes sfrcVictoryFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sfrcTrophyBounce {
          0%,100% { transform: scale(1) translateY(0); }
          25%     { transform: scale(1.18) translateY(-12px); }
          50%     { transform: scale(1.08) translateY(-6px); }
          75%     { transform: scale(1.14) translateY(-9px); }
        }
        @keyframes sfrcChampionGlow {
          0%,100% { text-shadow: 0 0 30px rgba(251,191,36,0.6), 0 0 60px rgba(251,191,36,0.3); }
          50%     { text-shadow: 0 0 60px rgba(251,191,36,1), 0 0 120px rgba(251,191,36,0.7), 0 0 200px rgba(245,158,11,0.4); }
        }
        @keyframes sfrcTeamNameReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sfrcRingPulse {
          0%,100% { transform: scale(1);   opacity: 0.35; }
          50%     { transform: scale(1.12); opacity: 0.08; }
        }
      `}</style>

      {/* Confetti rain */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {PIECES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '-12px',
              left: `${p.left}%`,
              width:  p.size,
              height: p.size * 0.55,
              background: p.color,
              borderRadius: 2,
              transform: `skewX(${p.skew}deg)`,
              animationName: 'sfrcConfettiFall',
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Ambient gold glow rings */}
      <div aria-hidden className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="absolute w-[500px] h-[500px] rounded-full border border-amber-400/30"
          style={{ animation: 'sfrcRingPulse 3s ease-in-out infinite' }} />
        <div className="absolute w-[700px] h-[700px] rounded-full border border-amber-400/15"
          style={{ animation: 'sfrcRingPulse 3s ease-in-out infinite', animationDelay: '1s' }} />
      </div>

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-8 text-center"
        style={{ animation: 'sfrcVictoryFadeIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        <div style={{ fontSize: 'clamp(5rem, 18vw, 10rem)', lineHeight: 1, animation: 'sfrcTrophyBounce 2.4s ease-in-out infinite', filter: 'drop-shadow(0 0 40px rgba(251,191,36,0.8))' }}>
          🏆
        </div>
        <div style={{ fontSize: 'clamp(2.4rem, 8vw, 6rem)', fontWeight: 900, fontFamily: '"Anton", "Impact", "Arial Black", sans-serif', letterSpacing: '0.25em', color: '#fbbf24', animation: 'sfrcChampionGlow 2s ease-in-out infinite' }}>
          CHAMPION
        </div>
        <div className="w-64 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <div style={{ fontSize: 'clamp(1.6rem, 5vw, 3.6rem)', fontWeight: 800, fontFamily: '"Inter", "SF Pro Display", "Helvetica Neue", sans-serif', color: '#fff', letterSpacing: '0.05em', textShadow: '0 2px 20px rgba(0,0,0,0.8)', maxWidth: '80vw', lineHeight: 1.2, animation: 'sfrcTeamNameReveal 0.6s ease-out 0.4s both' }}>
          {teamName}
        </div>
        <div className="text-amber-400/30 text-[10px] font-mono tracking-[0.4em] uppercase mt-4">
          SFRC · STARTUP FEST ROBOTICS CHALLENGE
        </div>
      </div>
    </div>
  )
}
