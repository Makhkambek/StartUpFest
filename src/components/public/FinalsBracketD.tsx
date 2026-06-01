'use client'

interface TeamLite {
  id: string
  name: string | null
  school: string | null
  alliance_name?: string | null
}

export interface FinalMatchD {
  match_id: string
  status: string
  red: TeamLite | null
  redPartner: TeamLite | null
  white: TeamLite | null
  whitePartner: TeamLite | null
  goals1: number | null
  goals2: number | null
}

interface Alliance {
  id: string
  named: boolean       // has a custom alliance_name
  displayName: string  // alliance_name or "Cap + Partner" or cap name
  subName: string      // schools or partner school, shown smaller
  w: number; d: number; l: number
  gf: number; ga: number
  pts: number
}

function buildAlliance(cap: TeamLite | null, partner: TeamLite | null): { named: boolean; displayName: string; subName: string } {
  if (!cap) return { named: false, displayName: 'TBD', subName: '' }
  if (cap.alliance_name) return { named: true, displayName: cap.alliance_name, subName: [cap.name, partner?.name].filter(Boolean).join(' + ') }
  if (partner?.name)     return { named: false, displayName: `${cap.name ?? '?'} + ${partner.name}`, subName: [cap.school, partner.school].filter(Boolean).join(' · ') }
  return { named: false, displayName: cap.name ?? 'TBD', subName: cap.school ?? '' }
}

function buildData(matches: FinalMatchD[]): { alliances: Alliance[] } {
  const map = new Map<string, Alliance>()

  const ensure = (cap: TeamLite | null, partner: TeamLite | null) => {
    if (!cap || map.has(cap.id)) return
    const a = buildAlliance(cap, partner)
    map.set(cap.id, { id: cap.id, ...a, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })
  }

  for (const m of matches) {
    ensure(m.red, m.redPartner)
    ensure(m.white, m.whitePartner)
  }

  for (const m of matches) {
    const red   = m.red   ? map.get(m.red.id)   : null
    const white = m.white ? map.get(m.white.id) : null
    if (!red || !white || m.goals1 === null || m.goals2 === null) continue
    const g1 = m.goals1, g2 = m.goals2
    red.gf += g1; red.ga += g2; white.gf += g2; white.ga += g1
    if (g1 > g2)      { red.w++;   red.pts   += 3; white.l++ }
    else if (g2 > g1) { white.w++; white.pts += 3; red.l++ }
    else              { red.d++;   red.pts++;       white.d++; white.pts++ }
  }

  return {
    alliances: [...map.values()].sort(
      (a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    ),
  }
}

// ── Static CSS keyframes injected once ───────────────────────────────────────
const KEYFRAMES = `
@keyframes fdbd-in   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
@keyframes fdbd-gold { 0%,100% { box-shadow:0 0 0 0 rgba(251,191,36,0) }  55% { box-shadow:0 0 28px 4px rgba(251,191,36,0.22) } }
@keyframes fdbd-live { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0) }  55% { box-shadow:0 0 20px 3px rgba(59,130,246,0.4)  } }
@keyframes fdbd-dot  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.3; transform:scale(0.65) } }
@keyframes fdbd-pop  { 0% { transform:scale(0.7); opacity:0 } 65% { transform:scale(1.1) } 100% { transform:scale(1); opacity:1 } }
@keyframes fdbd-vs   { 0%,100% { opacity:0.3 } 50% { opacity:0.7 } }
@keyframes fdbd-shine {
  0%   { background-position: -200% center }
  100% { background-position:  200% center }
}
`

const MEDALS = ['🥇', '🥈', '🥉']
const RANK_COLORS = [
  { ring: '#FBBF24', glow: 'rgba(251,191,36,0.18)', label: '#FBBF24' },
  { ring: '#94A3B8', glow: 'rgba(148,163,184,0.12)', label: '#94A3B8' },
  { ring: '#B45309', glow: 'rgba(180,83,9,0.12)',    label: '#CD7C2F' },
]

export default function FinalsBracketD({
  matches,
  dark = false,
  scale = 1,
}: {
  matches: FinalMatchD[]
  dark?: boolean
  scale?: number
}) {
  const sc  = Math.max(0.6, scale)
  const r   = (n: number) => Math.round(n * sc)
  const fnt = '"Inter","SF Pro Display","Helvetica Neue",system-ui,sans-serif'

  // ── Palette ────────────────────────────────────────────────────────────────
  const textPri  = dark ? 'rgba(255,255,255,0.95)' : '#0f172a'
  const textSec  = dark ? 'rgba(255,255,255,0.45)' : '#64748b'
  const textDim  = dark ? 'rgba(255,255,255,0.22)' : '#94a3b8'
  const border   = dark ? 'rgba(255,255,255,0.09)' : '#e2e8f0'
  const surface  = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'
  const green    = dark ? '#4ade80' : '#16a34a'
  const red_c    = dark ? '#f87171' : '#dc2626'
  const amber_c  = dark ? '#fbbf24' : '#d97706'

  if (matches.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:r(48)+'px', color:textDim, fontSize:r(13), fontFamily:fnt }}>
        Finals not generated yet
      </div>
    )
  }

  const { alliances } = buildData(matches)
  const allDone = matches.length > 0 && matches.every(m => m.goals1 !== null && m.goals2 !== null)

  return (
    <div style={{ fontFamily: fnt }}>
      <style>{KEYFRAMES}</style>

      {/* ══ STANDINGS ══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: r(20) }}>

        {/* Section label */}
        <div style={{
          fontSize: r(9), fontWeight: 800, letterSpacing: '0.2em', color: textDim,
          textTransform: 'uppercase', marginBottom: r(12),
          paddingLeft: r(4),
        }}>
          ⚽ Finals Standings
        </div>

        {alliances.map((a, i) => {
          const rc      = RANK_COLORS[i] ?? RANK_COLORS[2]
          const isFirst = i === 0 && allDone
          const delay   = i * 90

          return (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: r(14),
                padding: `${r(14)}px ${r(18)}px`,
                marginBottom: r(8),
                borderRadius: r(16),
                border: `1.5px solid ${isFirst ? rc.ring : border}`,
                background: isFirst
                  ? (dark ? 'rgba(251,191,36,0.07)' : '#fffbeb')
                  : surface,
                animation: [
                  `fdbd-in 0.45s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
                  isFirst ? 'fdbd-gold 3.5s ease-in-out 0.6s infinite' : '',
                ].filter(Boolean).join(', '),
              }}
            >
              {/* Medal / rank */}
              <div style={{
                width: r(36), height: r(36), borderRadius: r(10), flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: dark ? `rgba(255,255,255,0.05)` : '#f1f5f9',
                border: `1.5px solid ${isFirst ? rc.ring + '55' : border}`,
                fontSize: r(allDone ? 20 : 13),
                fontWeight: 900, color: rc.label,
              }}>
                {allDone ? MEDALS[i] ?? String(i + 1) : String(i + 1)}
              </div>

              {/* Name block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: r(15), fontWeight: 800, lineHeight: 1.2,
                  letterSpacing: a.named ? '0.03em' : '-0.01em',
                  color: isFirst ? rc.label : textPri,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  ...(a.named && isFirst && dark ? {
                    background: `linear-gradient(90deg, #FBBF24, #FDE68A, #FBBF24)`,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'fdbd-shine 3s linear infinite',
                  } : {}),
                }}>
                  {a.displayName}
                </div>
                {a.subName && (
                  <div style={{
                    fontSize: r(10), color: textDim, marginTop: r(2),
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontWeight: 500, letterSpacing: '0.01em',
                  }}>
                    {a.subName}
                  </div>
                )}
              </div>

              {/* W / D / L */}
              <div style={{ display: 'flex', gap: r(6), flexShrink: 0 }}>
                {([
                  [a.w, green,   'W'],
                  [a.d, amber_c, 'D'],
                  [a.l, red_c,   'L'],
                ] as [number, string, string][]).map(([val, col, lbl]) => (
                  <div key={lbl} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: r(28),
                  }}>
                    <span style={{ fontSize: r(14), fontWeight: 800, color: col, lineHeight: 1 }}>{val}</span>
                    <span style={{ fontSize: r(8), color: textDim, fontWeight: 700, letterSpacing: '0.05em' }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: r(28), background: border, flexShrink: 0 }} />

              {/* Points */}
              <div style={{ flexShrink: 0, textAlign: 'center', minWidth: r(40) }}>
                <div style={{
                  fontSize: r(22), fontWeight: 900, lineHeight: 1,
                  color: isFirst ? rc.label : textPri,
                  letterSpacing: '-0.03em',
                }}>{a.pts}</div>
                <div style={{ fontSize: r(8), color: textDim, fontWeight: 700, letterSpacing: '0.08em' }}>PTS</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ══ MATCHES ════════════════════════════════════════════════════════════ */}
      <div>
        <div style={{
          fontSize: r(9), fontWeight: 800, letterSpacing: '0.2em', color: textDim,
          textTransform: 'uppercase', marginBottom: r(12), paddingLeft: r(4),
        }}>
          Results
        </div>

        {matches.map((m, idx) => {
          const played    = m.goals1 !== null && m.goals2 !== null
          const isLive    = m.status === 'active'
          const redWon    = played && m.goals1! > m.goals2!
          const whiteWon  = played && m.goals2! > m.goals1!
          const isDraw    = played && m.goals1 === m.goals2

          const redInfo   = buildAlliance(m.red, m.redPartner)
          const whiteInfo = buildAlliance(m.white, m.whitePartner)

          const delay = alliances.length * 90 + idx * 90

          return (
            <div
              key={m.match_id}
              style={{
                marginBottom: r(8),
                borderRadius: r(16),
                border: `1.5px solid ${isLive ? '#3B82F6' : border}`,
                background: isLive
                  ? (dark ? 'rgba(59,130,246,0.08)' : '#eff6ff')
                  : surface,
                overflow: 'hidden',
                animation: [
                  `fdbd-in 0.45s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
                  isLive ? 'fdbd-live 2.2s ease-in-out infinite' : '',
                ].filter(Boolean).join(', '),
              }}
            >
              {/* Match header strip */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${r(5)}px ${r(14)}px`,
                borderBottom: `1px solid ${isLive ? 'rgba(59,130,246,0.2)' : border}`,
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}>
                <span style={{ fontSize: r(8), fontWeight: 700, color: textDim, letterSpacing: '0.1em' }}>
                  MATCH {idx + 1}
                </span>
                {isLive && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: r(4),
                    fontSize: r(8), fontWeight: 800, color: '#3B82F6', letterSpacing: '0.12em',
                  }}>
                    <span style={{ animation: 'fdbd-dot 1s ease-in-out infinite', display:'inline-block' }}>●</span>
                    LIVE
                  </span>
                )}
                {isDraw && played && (
                  <span style={{ fontSize: r(8), fontWeight: 700, color: amber_c }}>DRAW</span>
                )}
              </div>

              {/* Score row */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>

                {/* Red side */}
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: `${r(12)}px ${r(14)}px`,
                  textAlign: 'right',
                  background: redWon
                    ? (dark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.05)')
                    : 'transparent',
                  borderRight: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <div style={{
                    fontSize: r(15), fontWeight: 800, lineHeight: 1.15,
                    color: !played ? textPri : redWon ? green : isDraw ? textSec : textDim,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    transition: 'color 0.5s',
                    letterSpacing: redInfo.named ? '0.02em' : '-0.01em',
                  }}>
                    {redInfo.displayName}
                    {redWon && <span style={{ marginLeft: r(6), fontSize: r(12) }}>✓</span>}
                  </div>
                  {redInfo.subName && (
                    <div style={{ fontSize: r(9), color: textDim, marginTop: r(2), fontWeight: 500 }}>
                      {redInfo.subName}
                    </div>
                  )}
                </div>

                {/* Score center */}
                <div style={{
                  flexShrink: 0, width: r(88),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: `${r(12)}px ${r(8)}px`,
                }}>
                  {played ? (
                    <div style={{
                      fontFamily: '"SF Mono","Fira Mono","Consolas",monospace',
                      fontWeight: 900, fontSize: r(26),
                      color: textPri, letterSpacing: '-0.03em', lineHeight: 1,
                      animation: 'fdbd-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
                    }}>
                      {m.goals1}<span style={{ color: textDim, fontWeight: 300, margin: `0 ${r(3)}px` }}>:</span>{m.goals2}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: r(13), fontWeight: 700, color: textDim,
                      animation: isLive ? undefined : 'fdbd-vs 2.5s ease-in-out infinite',
                      letterSpacing: '0.05em',
                    }}>
                      {isLive ? '— : —' : 'vs'}
                    </div>
                  )}
                </div>

                {/* White side */}
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: `${r(12)}px ${r(14)}px`,
                  textAlign: 'left',
                  background: whiteWon
                    ? (dark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.05)')
                    : 'transparent',
                  borderLeft: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <div style={{
                    fontSize: r(15), fontWeight: 800, lineHeight: 1.15,
                    color: !played ? textPri : whiteWon ? green : isDraw ? textSec : textDim,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    transition: 'color 0.5s',
                    letterSpacing: whiteInfo.named ? '0.02em' : '-0.01em',
                  }}>
                    {whiteWon && <span style={{ marginRight: r(6), fontSize: r(12) }}>✓</span>}
                    {whiteInfo.displayName}
                  </div>
                  {whiteInfo.subName && (
                    <div style={{ fontSize: r(9), color: textDim, marginTop: r(2), fontWeight: 500 }}>
                      {whiteInfo.subName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
