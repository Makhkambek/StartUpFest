'use client'

interface BracketTeam {
  id: string
  name: string | null
  school: string | null
}

interface BracketMatch {
  match_id: string
  status: string
  red: BracketTeam | null
  white: BracketTeam | null
  winner: 1 | 2 | 0 | null
  rounds1: number | null
  rounds2: number | null
}

function getRound(match_id: string) {
  const id = match_id.toUpperCase()
  if (id.includes('-QF')) return 'quarter' as const
  if (id.includes('-SF')) return 'semi' as const
  if (id.endsWith('-3RD')) return 'third_place' as const
  if (id.endsWith('-F1') || id.endsWith('-F')) return 'final' as const
  if (id.includes('-R1')) return 'r1' as const
  if (id.includes('-R2')) return 'r2' as const
  if (id.includes('-T')) return 'triangle' as const
  return 'final' as const
}

function dims(scale: number, colGapMult = 1) {
  const s = Math.max(0.5, scale)
  return {
    cardW:      Math.round(180 * s),
    cardH:      Math.round(72 * s),
    finalCardH: Math.round(96 * s),   // Final card is taller
    colGap:     Math.round(64 * s * colGapMult),
    matchGap:   Math.round(16 * s),
    groupGap:   Math.round(44 * s),
    labelH:     Math.round(32 * s),
    radius:     Math.round(9 * s),
    borderW:    s >= 1.3 ? 2 : 1.5,
    px:         Math.round(12 * s),
    gap:        Math.round(6 * s),
    nameSz:     Math.round(13 * s),
    finalNameSz:Math.round(15 * s),
    scoreSz:    Math.round(13 * s),
    iconSz:     Math.round(11 * s),
    finalIconSz:Math.round(14 * s),
    lineW:      s >= 1.3 ? 2 : 1.5,
    labelSz:    Math.round(9 * s),
  }
}

type Dims = ReturnType<typeof dims>

function TeamRow({
  name, score, won, done, dark, isLast, isFinal, s,
}: {
  name: string | null
  score: number | null
  won: boolean
  done: boolean
  dark: boolean
  isLast?: boolean
  isFinal?: boolean
  s: Dims
}) {
  const rowH = isFinal ? s.finalCardH / 2 : s.cardH / 2
  const nameSz = isFinal ? s.finalNameSz : s.nameSz
  const iconSz = isFinal ? s.finalIconSz : s.iconSz

  const winnerRowBg = isFinal
    ? (dark
      ? 'linear-gradient(90deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.08) 100%)'
      : 'linear-gradient(90deg, #FEF3C7 0%, #FFFBEB 100%)')
    : (dark
      ? 'linear-gradient(90deg, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.10) 100%)'
      : 'linear-gradient(90deg, #ECFDF5 0%, #F0FDF4 100%)')

  const loserBg  = dark ? 'rgba(255,255,255,0.03)' : '#FAFAFA'
  const pendingBg = isFinal
    ? (dark ? 'rgba(245,158,11,0.04)' : '#FFFBEB')
    : (dark ? 'rgba(255,255,255,0.06)' : '#fff')

  const bg = done ? (won ? winnerRowBg : loserBg) : pendingBg

  const winnerCol = isFinal ? (dark ? '#FCD34D' : '#92400E') : (dark ? '#FCD34D' : '#047857')
  const normalCol = dark ? 'rgba(255,255,255,0.9)' : '#1F2937'
  const dimCol    = dark ? 'rgba(255,255,255,0.28)' : '#9CA3AF'

  return (
    <div style={{
      height: rowH, display: 'flex', alignItems: 'center',
      padding: `0 ${s.px}px`, gap: s.gap,
      background: bg,
      borderBottom: isLast ? undefined : `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#F3F4F6'}`,
    }}>
      {won && <span style={{ fontSize: iconSz, flexShrink: 0, lineHeight: 1 }}>
        {isFinal ? '👑' : '🏆'}
      </span>}
      <span style={{
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: nameSz, fontWeight: done && !won ? 500 : 700, lineHeight: 1,
        color: done ? (won ? winnerCol : dimCol) : normalCol,
        letterSpacing: '-0.01em',
        textDecoration: done && !won ? 'line-through' : 'none',
        opacity: done && !won ? 0.4 : 1,
      }}>
        {name || ''}
      </span>
      {done && (
        <span style={{
          fontFamily: 'monospace', fontWeight: 800,
          fontSize: isFinal ? Math.round(s.scoreSz * 1.15) : s.scoreSz,
          flexShrink: 0, textAlign: 'right',
          color: won ? winnerCol : dimCol,
          opacity: done && !won ? 0.4 : 1,
        }}>
          {score ?? 0}
        </span>
      )}
    </div>
  )
}

function MatchCard({ m, dark = false, highlight = false, isFinal = false, s }: {
  m: BracketMatch
  dark?: boolean
  highlight?: boolean
  isFinal?: boolean
  s: Dims
}) {
  const isGhost  = !m.red && !m.white
  const redWon   = m.winner === 1
  const whiteWon = m.winner === 2
  const done     = redWon || whiteWon
  const pending  = m.status === 'pending' && m.red && m.white
  const h        = isFinal ? s.finalCardH : s.cardH

  const borderCol = isGhost
    ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
    : isFinal
      ? '#F59E0B'
      : highlight
        ? (dark ? '#CD7F32' : '#B45309')
        : (dark ? 'rgba(255,255,255,0.2)' : '#D1D5DB')

  const borderW = isFinal ? (s.borderW + 1.5) : s.borderW
  const borderStyle = isGhost ? 'dashed' : 'solid'

  const shadow = isFinal
    ? `0 0 40px rgba(245,158,11,0.55), 0 0 80px rgba(245,158,11,0.2), 0 4px 16px rgba(0,0,0,0.5)`
    : highlight
      ? `0 0 16px rgba(180,100,30,0.35)`
      : pending && dark
        ? '0 0 10px rgba(255,255,255,0.05)'
        : dark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)'

  return (
    <div style={{
      width: s.cardW, height: h,
      borderRadius: s.radius + (isFinal ? 2 : 0),
      overflow: 'hidden',
      border: `${borderW}px ${borderStyle} ${borderCol}`,
      boxShadow: isGhost ? 'none' : shadow,
      backdropFilter: dark ? 'blur(6px)' : undefined,
      background: isFinal && dark ? 'rgba(10,8,4,0.95)' : undefined,
      opacity: isGhost ? 0.4 : 1,
    }}>
      <TeamRow name={m.red?.name ?? null}   score={m.rounds1 ?? null} won={redWon}   done={done} dark={dark} isFinal={isFinal} s={s} />
      <TeamRow name={m.white?.name ?? null} score={m.rounds2 ?? null} won={whiteWon} done={done} dark={dark} isFinal={isFinal} s={s} isLast />
    </div>
  )
}

// ── Triangle Section: standings + match results (round-robin display) ─────────

const TRI_KEYFRAMES = `
@keyframes triFadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes triGold   { 0%,100% { box-shadow:0 0 0 0 rgba(245,158,11,0) } 55% { box-shadow:0 0 24px 3px rgba(245,158,11,0.22) } }
@keyframes triPop    { 0% { transform:scale(0.75); opacity:0 } 65% { transform:scale(1.1) } 100% { transform:scale(1); opacity:1 } }
@keyframes triVs     { 0%,100% { opacity:0.3 } 50% { opacity:0.7 } }
`

interface TriAlliance { id: string; name: string | null; w: number; l: number; pts: number }

function buildTriangle(matches: BracketMatch[]): TriAlliance[] {
  const map = new Map<string, TriAlliance>()
  const ensure = (t: BracketTeam | null) => {
    if (!t || map.has(t.id)) return
    map.set(t.id, { id: t.id, name: t.name, w: 0, l: 0, pts: 0 })
  }
  for (const m of matches) { ensure(m.red); ensure(m.white) }
  for (const m of matches) {
    if (m.winner === null || m.winner === 0) continue
    const red   = m.red   ? map.get(m.red.id)   : null
    const white = m.white ? map.get(m.white.id) : null
    if (!red || !white) continue
    if (m.winner === 1) { red.w++;   red.pts   += 3; white.l++ }
    else                { white.w++; white.pts += 3; red.l++ }
  }
  return [...map.values()].sort((a, b) => b.pts - a.pts || b.w - a.w)
}

const TRI_MEDALS = ['🥇', '🥈', '🥉']

function TriangleSection({ matches, dark, scale }: { matches: BracketMatch[]; dark: boolean; scale: number }) {
  const sc = Math.max(0.5, scale)
  const r  = (n: number) => Math.round(n * sc)
  const fnt = '"Inter","SF Pro Display","Helvetica Neue",system-ui,sans-serif'

  const textPri  = dark ? 'rgba(255,255,255,0.93)' : '#0f172a'
  const textSec  = dark ? 'rgba(255,255,255,0.5)'  : '#64748b'
  const textDim  = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'
  const border   = dark ? 'rgba(255,255,255,0.09)' : '#e2e8f0'
  const surface  = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'
  const gold     = dark ? '#fbbf24'                : '#d97706'
  const goldBd   = dark ? 'rgba(251,191,36,0.3)'  : '#fde68a'
  const goldBg   = dark ? 'rgba(251,191,36,0.08)' : '#fffbeb'
  const green    = dark ? '#4ade80'                : '#16a34a'
  const redC     = dark ? '#f87171'                : '#dc2626'

  const alliances = buildTriangle(matches)
  const allDone   = matches.length > 0 && matches.every(m => m.winner !== null)

  return (
    <div style={{ fontFamily: fnt }}>
      <style>{TRI_KEYFRAMES}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: r(10),
        marginBottom: r(14),
      }}>
        <div style={{
          flex: 1, height: 1, background: border,
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: r(8),
          padding: `${r(6)}px ${r(14)}px`,
          borderRadius: r(20),
          border: `1.5px solid ${dark ? 'rgba(245,158,11,0.35)' : '#fde68a'}`,
          background: goldBg,
        }}>
          <span style={{ fontSize: r(14) }}>⚡</span>
          <span style={{
            fontSize: r(10), fontWeight: 800, letterSpacing: '0.18em',
            color: gold, textTransform: 'uppercase',
          }}>Triangle Final · Round Robin</span>
        </div>
        <div style={{ flex: 1, height: 1, background: border }} />
      </div>

      {/* Standings */}
      <div style={{ marginBottom: r(16) }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: r(9), fontWeight: 700, letterSpacing: '0.14em',
          color: textDim, textTransform: 'uppercase',
          marginBottom: r(8), paddingLeft: r(4),
        }}>
          <span>Standings</span>
          <span style={{ paddingRight: r(4) }}>W · L · Pts</span>
        </div>

        {alliances.map((a, i) => {
          const isTop   = i === 0 && allDone
          const delay   = i * 80
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: r(12),
              padding: `${r(11)}px ${r(16)}px`,
              marginBottom: r(6),
              borderRadius: r(12),
              border: `1.5px solid ${isTop ? goldBd : border}`,
              background: isTop ? goldBg : surface,
              animation: `triFadeUp 0.4s ease-out ${delay}ms both${isTop ? ', triGold 3.5s ease-in-out 0.5s infinite' : ''}`,
            }}>
              {/* Medal / rank */}
              <div style={{
                width: r(32), height: r(32), borderRadius: r(8), flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                border: `1.5px solid ${isTop ? goldBd : border}`,
                fontSize: r(allDone ? 17 : 12), fontWeight: 900,
                color: isTop ? gold : textDim,
              }}>
                {allDone ? TRI_MEDALS[i] ?? String(i + 1) : String(i + 1)}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: r(14), fontWeight: 800, color: isTop ? gold : textPri,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
                  letterSpacing: '-0.01em',
                }}>{a.name ?? 'TBD'}</span>
              </div>

              {/* W / L */}
              <div style={{ display: 'flex', alignItems: 'center', gap: r(12), flexShrink: 0 }}>
                <div style={{ textAlign: 'center', minWidth: r(22) }}>
                  <div style={{ fontSize: r(14), fontWeight: 800, color: green, lineHeight: 1 }}>{a.w}</div>
                  <div style={{ fontSize: r(8), color: textDim, fontWeight: 700 }}>W</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: r(22) }}>
                  <div style={{ fontSize: r(14), fontWeight: 800, color: redC, lineHeight: 1 }}>{a.l}</div>
                  <div style={{ fontSize: r(8), color: textDim, fontWeight: 700 }}>L</div>
                </div>
                <div style={{ width: 1, height: r(24), background: border }} />
                <div style={{ textAlign: 'center', minWidth: r(32) }}>
                  <div style={{ fontSize: r(20), fontWeight: 900, color: isTop ? gold : textPri, lineHeight: 1, letterSpacing: '-0.03em' }}>{a.pts}</div>
                  <div style={{ fontSize: r(8), color: textDim, fontWeight: 700, letterSpacing: '0.06em' }}>PTS</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Match results */}
      <div>
        <div style={{
          fontSize: r(9), fontWeight: 700, letterSpacing: '0.14em',
          color: textDim, textTransform: 'uppercase',
          marginBottom: r(8), paddingLeft: r(4),
        }}>Results</div>

        {matches.map((m, idx) => {
          const done      = m.winner !== null && m.winner !== 0
          const redWon    = m.winner === 1
          const whiteWon  = m.winner === 2
          const isLive    = m.status === 'active'
          const delay     = alliances.length * 80 + idx * 80

          return (
            <div key={m.match_id} style={{
              marginBottom: r(6),
              borderRadius: r(12),
              border: `1.5px solid ${isLive ? '#3B82F6' : border}`,
              background: isLive ? (dark ? 'rgba(59,130,246,0.08)' : '#eff6ff') : surface,
              overflow: 'hidden',
              animation: `triFadeUp 0.4s ease-out ${delay}ms both`,
            }}>
              {/* Match label strip */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${r(4)}px ${r(14)}px`,
                borderBottom: `1px solid ${border}`,
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}>
                <span style={{ fontSize: r(8), fontWeight: 700, color: textDim, letterSpacing: '0.1em' }}>
                  MATCH {idx + 1}
                </span>
                {isLive && (
                  <span style={{ fontSize: r(8), fontWeight: 800, color: '#3B82F6', letterSpacing: '0.1em' }}>
                    ● LIVE
                  </span>
                )}
              </div>

              {/* Score row */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                {/* Red */}
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: `${r(11)}px ${r(14)}px`,
                  textAlign: 'right',
                  background: redWon ? (dark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.04)') : 'transparent',
                  borderRight: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: r(14), fontWeight: 800, display: 'block',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: !done ? textPri : redWon ? green : textDim,
                    transition: 'color 0.4s',
                  }}>
                    {redWon && <span style={{ marginRight: r(5), fontSize: r(11) }}>✓</span>}
                    {m.red?.name ?? 'TBD'}
                  </span>
                </div>

                {/* Score center */}
                <div style={{
                  flexShrink: 0, width: r(80),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: `${r(11)}px ${r(6)}px`,
                }}>
                  {done ? (
                    <span style={{
                      fontFamily: '"SF Mono","Fira Mono","Consolas",monospace',
                      fontWeight: 900, fontSize: r(20),
                      color: textPri, letterSpacing: '-0.03em', lineHeight: 1,
                      animation: 'triPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                    }}>
                      {m.rounds1 ?? 0}
                      <span style={{ color: textDim, fontWeight: 300, margin: `0 ${r(3)}px` }}>:</span>
                      {m.rounds2 ?? 0}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: r(12), color: textDim, fontWeight: 600,
                      animation: isLive ? undefined : 'triVs 2.5s ease-in-out infinite',
                    }}>
                      {isLive ? '–:–' : 'vs'}
                    </span>
                  )}
                </div>

                {/* White */}
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: `${r(11)}px ${r(14)}px`,
                  textAlign: 'left',
                  background: whiteWon ? (dark ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.04)') : 'transparent',
                  borderLeft: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: r(14), fontWeight: 800, display: 'block',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: !done ? textPri : whiteWon ? green : textDim,
                    transition: 'color 0.4s',
                  }}>
                    {whiteWon && <span style={{ marginRight: r(5), fontSize: r(11) }}>✓</span>}
                    {m.white?.name ?? 'TBD'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FinalsBracketB({
  matches,
  dark = false,
  scale = 1,
  colGapMult = 1,
}: {
  matches: BracketMatch[]
  dark?: boolean
  scale?: number
  colGapMult?: number
}) {
  const s = dims(scale, colGapMult)
  const sort = (arr: BracketMatch[]) =>
    [...arr].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))

  const qf         = sort(matches.filter(m => getRound(m.match_id) === 'quarter' || getRound(m.match_id) === 'r1'))
  const sf         = sort(matches.filter(m => getRound(m.match_id) === 'semi'    || getRound(m.match_id) === 'r2'))
  const thirdPlace = matches.filter(m => getRound(m.match_id) === 'third_place')
  const final      = matches.filter(m => getRound(m.match_id) === 'final')
  const triangle   = sort(matches.filter(m => getRound(m.match_id) === 'triangle'))

  // Triangle-only display (when r1/r2 already cleaned up or not generated)
  if (triangle.length > 0 && qf.length === 0 && sf.length === 0) {
    return <TriangleSection matches={triangle} dark={dark} scale={scale} />
  }

  const isV10 = matches.some(m => getRound(m.match_id) === 'r1' || getRound(m.match_id) === 'r2')

  // Ghost cards: show the full bracket path from R1 generation.
  // When R2 / Triangle haven't been generated yet, fill with TBD placeholders.
  const ghostCard = (id: string): BracketMatch => ({
    match_id: id, status: 'pending',
    red: null, white: null, winner: null, rounds1: null, rounds2: null,
  })
  let displaySF       = sf
  let displayTriangle = triangle
  if (isV10 && qf.length >= 4) {
    const expectedSF = Math.ceil(qf.length / 2)
    if (sf.length < expectedSF) {
      displaySF = [
        ...sf,
        ...Array.from({ length: expectedSF - sf.length }, (_, i) => ghostCard(`FB-R2-${sf.length + i + 1}`)),
      ]
    }
    if (displaySF.length === 3 && triangle.length < 3) {
      displayTriangle = [
        ...triangle,
        ...Array.from({ length: 3 - triangle.length }, (_, i) => ghostCard(`FB-T${triangle.length + i + 1}`)),
      ]
    }
  }

  const qfLabel     = isV10 ? 'ROUND 1' : 'QUARTER-FINAL'
  const sfLabel     = isV10 ? 'ROUND 2' : 'SEMI-FINAL'
  const hasQF       = qf.length > 0
  const hasSF       = displaySF.length > 0
  const hasFinal    = final.length > 0 || thirdPlace.length > 0
  // Triangle alongside R1/R2
  const hasTriangle = displayTriangle.length > 0 && (hasQF || hasSF)
  const hasFinalCol = hasFinal || hasTriangle

  if (!hasQF && !hasSF && !hasFinalCol) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', fontSize: s.nameSz,
        color: dark ? 'rgba(255,255,255,0.3)' : '#9CA3AF', letterSpacing: '0.05em' }}>
        No finals bracket generated yet
      </div>
    )
  }

  // ── Y layout ──────────────────────────────────────────────────────────────
  const TOP  = s.labelH + 4

  // R1 / QF: up to 6 cards in 3 groups of 2
  const qf1Y = TOP
  const qf2Y = TOP + s.cardH + s.matchGap
  const qf3Y = TOP + (s.cardH + s.matchGap) * 2 + s.groupGap
  const qf4Y = TOP + (s.cardH + s.matchGap) * 3 + s.groupGap
  const qf5Y = TOP + (s.cardH + s.matchGap) * 4 + s.groupGap * 2
  const qf6Y = TOP + (s.cardH + s.matchGap) * 5 + s.groupGap * 2

  const qf1CY = qf1Y + s.cardH / 2
  const qf2CY = qf2Y + s.cardH / 2
  const qf3CY = qf3Y + s.cardH / 2
  const qf4CY = qf4Y + s.cardH / 2
  const qf5CY = qf5Y + s.cardH / 2
  const qf6CY = qf6Y + s.cardH / 2

  // R2 / SF: center of each pair
  const sf1CY = hasQF && qf.length >= 2 ? (qf1CY + qf2CY) / 2 : TOP + s.cardH / 2
  const sf2CY = hasQF && qf.length >= 4 ? (qf3CY + qf4CY) / 2 : sf1CY + s.cardH + s.groupGap
  // 6 R1 matches: sf3 is between pair3 centres; 5 R1 matches: lone 5th match → sf3 aligns directly with it
  const sf3CY = hasQF && qf.length >= 6 ? (qf5CY + qf6CY) / 2
              : hasQF && qf.length === 5 ? qf5CY
              : sf2CY + s.cardH + s.groupGap
  const sf1Y  = sf1CY - s.cardH / 2
  const sf2Y  = sf2CY - s.cardH / 2
  const sf3Y  = sf3CY - s.cardH / 2

  // Triangle cards sit at the same Y as the R2 cards they feed from → horizontal lines
  // tri1Y = sf1Y, tri2Y = sf2Y, tri3Y = sf3Y (implicit)

  // Final / 3rd place (only used when hasFinal without triangle)
  const finalCY  = hasSF && displaySF.length >= 2 ? (sf1CY + sf2CY) / 2 : TOP + s.finalCardH / 2
  const finalY   = finalCY - s.finalCardH / 2
  const thirdGap = Math.round(32 * scale)
  const thirdY   = finalY + s.finalCardH + thirdGap
  const thirdCY  = thirdY + s.cardH / 2

  // ── X layout ──────────────────────────────────────────────────────────────
  const numCols = (hasQF ? 1 : 0) + (hasSF ? 1 : 0) + (hasFinalCol ? 1 : 0)
  let colIdx = 0
  const qfX    = hasQF       ? colIdx++ * (s.cardW + s.colGap) : 0
  const sfX    = hasSF       ? colIdx++ * (s.cardW + s.colGap) : (hasQF ? 1 : 0) * (s.cardW + s.colGap)
  const finalX = hasFinalCol ? colIdx  * (s.cardW + s.colGap) : 0

  const mid1X = qfX    + s.cardW + s.colGap / 2
  const mid2X = sfX    + s.cardW + s.colGap / 2

  const totalW = numCols > 0 ? (numCols - 1) * (s.cardW + s.colGap) + s.cardW : s.cardW
  const totalH = Math.max(
    hasQF       ? (qf.length >= 6 ? qf6Y + s.cardH : qf.length >= 5 ? qf5Y + s.cardH : qf4Y + s.cardH) : 0,
    hasSF       ? (displaySF.length >= 3 ? sf3Y + s.cardH : sf2Y + s.cardH) : 0,
    hasFinal    ? thirdY + s.cardH  : 0,
    hasTriangle ? sf3Y  + s.cardH  : 0,  // triangle cards sit at sf3Y
  )

  // ── Colors ────────────────────────────────────────────────────────────────
  const lineCol    = dark ? 'rgba(255,255,255,0.22)' : '#D1D5DB'
  const labelCol   = dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'
  const bronzeCol  = dark ? 'rgba(180,110,40,0.7)'   : '#B45309'
  const goldCol    = dark ? 'rgba(245,158,11,0.6)'   : '#D97706'
  const sfDone     = sf.length >= 2 && sf.every(m => m.winner !== null && m.winner !== 0)
  const finalLineC = sfDone ? goldCol : lineCol

  // banner Y above final card
  const finalBannerH = Math.round(22 * scale)
  const finalBannerY = finalY - finalBannerH - Math.round(4 * scale)

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
      <div style={{ position: 'relative', width: totalW, height: totalH + 4 }}>

        {/* ── SVG: lines + labels ── */}
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={totalW} height={totalH + 4}>

          {/* Column header labels */}
          {hasQF && (
            <text x={qfX + s.cardW / 2} y={s.labelH - 8} textAnchor="middle"
              fontSize={s.labelSz} fontWeight={700} letterSpacing="0.14em"
              fill={labelCol} fontFamily="system-ui,sans-serif">{qfLabel}</text>
          )}
          {hasSF && (
            <text x={sfX + s.cardW / 2} y={s.labelH - 8} textAnchor="middle"
              fontSize={s.labelSz} fontWeight={700} letterSpacing="0.14em"
              fill={labelCol} fontFamily="system-ui,sans-serif">{sfLabel}</text>
          )}
          {hasFinalCol && !hasTriangle && (
            <text x={finalX + s.cardW / 2} y={s.labelH - 8} textAnchor="middle"
              fontSize={s.labelSz + 1} fontWeight={700} letterSpacing="0.18em"
              fill={dark ? '#F59E0B' : '#92400E'} fontFamily="system-ui,sans-serif">FINAL</text>
          )}
          {hasTriangle && (<>
            <text x={finalX + s.cardW / 2} y={s.labelH - 14} textAnchor="middle"
              fontSize={s.labelSz + 1} fontWeight={700} letterSpacing="0.18em"
              fill={dark ? '#F59E0B' : '#92400E'} fontFamily="system-ui,sans-serif">⚡ TRIANGLE</text>
            <text x={finalX + s.cardW / 2} y={s.labelH - 3} textAnchor="middle"
              fontSize={s.labelSz - 1} fontWeight={600} letterSpacing="0.12em"
              fill={dark ? 'rgba(245,158,11,0.5)' : '#B45309'} fontFamily="system-ui,sans-serif">ROUND ROBIN</text>
          </>)}

          {/* Pair 1 (QF1+QF2) → SF1 */}
          {hasQF && hasSF && qf.length >= 2 && displaySF.length >= 1 && (<>
            <path d={`M ${qfX + s.cardW} ${qf1CY} H ${mid1X} V ${qf2CY} H ${qfX + s.cardW}`}
              fill="none" stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
            <line x1={mid1X} y1={sf1CY} x2={sfX} y2={sf1CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
          </>)}

          {/* Pair 2 (QF3+QF4) → SF2 */}
          {hasQF && hasSF && qf.length >= 4 && displaySF.length >= 2 && (<>
            <path d={`M ${qfX + s.cardW} ${qf3CY} H ${mid1X} V ${qf4CY} H ${qfX + s.cardW}`}
              fill="none" stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
            <line x1={mid1X} y1={sf2CY} x2={sfX} y2={sf2CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
          </>)}

          {/* Pair 3 (QF5+QF6) → SF3 — 12-team bracket */}
          {hasQF && hasSF && qf.length >= 6 && displaySF.length >= 3 && (<>
            <path d={`M ${qfX + s.cardW} ${qf5CY} H ${mid1X} V ${qf6CY} H ${qfX + s.cardW}`}
              fill="none" stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
            <line x1={mid1X} y1={sf3CY} x2={sfX} y2={sf3CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
          </>)}
          {/* Lone QF5 → SF3 — 10-team bracket (5th match has no pair, goes directly) */}
          {hasQF && hasSF && qf.length === 5 && displaySF.length >= 3 && (
            <line x1={qfX + s.cardW} y1={qf5CY} x2={sfX} y2={sf3CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />
          )}

          {/* SF1+SF2 → Final (gold when SF done) — only in non-triangle bracket */}
          {hasSF && hasFinal && !hasTriangle && displaySF.length >= 2 && final.length >= 1 && (<>
            <path d={`M ${sfX + s.cardW} ${sf1CY} H ${mid2X} V ${sf2CY} H ${sfX + s.cardW}`}
              fill="none" stroke={finalLineC} strokeWidth={s.lineW} strokeLinecap="round" />
            <line x1={mid2X} y1={finalCY} x2={finalX} y2={finalCY}
              stroke={finalLineC} strokeWidth={s.lineW} strokeLinecap="round" />
          </>)}

          {/* SF → Triangle: 3 horizontal lines, one per R2 winner */}
          {hasSF && hasTriangle && (<>
            {displaySF.length >= 1 && <line x1={sfX + s.cardW} y1={sf1CY} x2={finalX} y2={sf1CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />}
            {displaySF.length >= 2 && <line x1={sfX + s.cardW} y1={sf2CY} x2={finalX} y2={sf2CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />}
            {displaySF.length >= 3 && <line x1={sfX + s.cardW} y1={sf3CY} x2={finalX} y2={sf3CY}
              stroke={lineCol} strokeWidth={s.lineW} strokeLinecap="round" />}
          </>)}

          {/* ── Loser path: SF losers → 3rd Place (dashed bronze) — non-triangle only ── */}
          {hasSF && thirdPlace.length > 0 && !hasTriangle && displaySF.length >= 2 && (<>
            <line x1={mid2X} y1={finalCY} x2={mid2X} y2={thirdCY}
              stroke={bronzeCol} strokeWidth={s.lineW} strokeDasharray={`${Math.round(6*scale)} ${Math.round(4*scale)}`} strokeLinecap="round" />
            <line x1={mid2X} y1={thirdCY} x2={finalX} y2={thirdCY}
              stroke={bronzeCol} strokeWidth={s.lineW} strokeDasharray={`${Math.round(6*scale)} ${Math.round(4*scale)}`} strokeLinecap="round" />
          </>)}

          {/* 3RD PLACE label (non-triangle only) */}
          {thirdPlace.length > 0 && !hasTriangle && (
            <text x={finalX + s.cardW / 2} y={thirdY - Math.round(8 * scale)}
              textAnchor="middle"
              fontSize={s.labelSz} fontWeight={700} letterSpacing="0.14em"
              fill={bronzeCol} fontFamily="system-ui,sans-serif">🥉 3RD PLACE</text>
          )}
        </svg>

        {/* ── QF / R1 cards (up to 6) ── */}
        {qf[0] && <div style={{ position: 'absolute', left: qfX, top: qf1Y }}><MatchCard m={qf[0]} dark={dark} s={s} /></div>}
        {qf[1] && <div style={{ position: 'absolute', left: qfX, top: qf2Y }}><MatchCard m={qf[1]} dark={dark} s={s} /></div>}
        {qf[2] && <div style={{ position: 'absolute', left: qfX, top: qf3Y }}><MatchCard m={qf[2]} dark={dark} s={s} /></div>}
        {qf[3] && <div style={{ position: 'absolute', left: qfX, top: qf4Y }}><MatchCard m={qf[3]} dark={dark} s={s} /></div>}
        {qf[4] && <div style={{ position: 'absolute', left: qfX, top: qf5Y }}><MatchCard m={qf[4]} dark={dark} s={s} /></div>}
        {qf[5] && <div style={{ position: 'absolute', left: qfX, top: qf6Y }}><MatchCard m={qf[5]} dark={dark} s={s} /></div>}

        {/* ── SF / R2 cards (up to 3, includes ghost TBD placeholders) ── */}
        {displaySF[0] && <div style={{ position: 'absolute', left: sfX, top: sf1Y }}><MatchCard m={displaySF[0]} dark={dark} s={s} /></div>}
        {displaySF[1] && <div style={{ position: 'absolute', left: sfX, top: sf2Y }}><MatchCard m={displaySF[1]} dark={dark} s={s} /></div>}
        {displaySF[2] && <div style={{ position: 'absolute', left: sfX, top: sf3Y }}><MatchCard m={displaySF[2]} dark={dark} s={s} /></div>}


        {/* ── FINAL card — non-triangle bracket ── */}
        {!hasTriangle && final[0] && (<>
          <div style={{
            position: 'absolute', left: finalX, top: finalBannerY,
            width: s.cardW, height: finalBannerH,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(5*scale),
            background: dark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
            border: `1px solid rgba(245,158,11,0.4)`,
            borderRadius: Math.round(6*scale),
            boxShadow: '0 0 20px rgba(245,158,11,0.2)',
          }}>
            <span style={{ fontSize: Math.round(9*scale), color: '#F59E0B', fontWeight: 800, letterSpacing: '0.18em', fontFamily: 'system-ui,sans-serif' }}>
              🏆 GRAND FINAL
            </span>
          </div>
          <div style={{ position: 'absolute', left: finalX, top: finalY }}>
            <MatchCard m={final[0]} dark={dark} highlight isFinal s={s} />
          </div>
        </>)}

        {/* ── 3rd place card — non-triangle bracket ── */}
        {!hasTriangle && thirdPlace[0] && (
          <div style={{ position: 'absolute', left: finalX, top: thirdY }}>
            <MatchCard m={thirdPlace[0]} dark={dark} highlight s={s} />
          </div>
        )}

        {/* ── Triangle column ── */}
        {hasTriangle && triangle.length === 0 && (
          /* Not yet generated → single tall placeholder spanning all 3 R2 positions */
          <div style={{
            position: 'absolute', left: finalX, top: sf1Y,
            width: s.cardW,
            height: sf3Y + s.cardH - sf1Y,
            borderRadius: s.radius,
            border: `${s.borderW}px dashed ${dark ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.6)'}`,
            background: dark ? 'rgba(245,158,11,0.05)' : 'rgba(255,251,235,0.8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: Math.round(6 * scale),
            padding: Math.round(12 * scale),
          }}>
            <span style={{ fontSize: Math.round(22 * scale), lineHeight: 1 }}>⚡</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: Math.round(9 * scale), fontWeight: 800, letterSpacing: '0.14em',
                color: dark ? '#F59E0B' : '#92400E', textTransform: 'uppercase',
              }}>Triangle Final</div>
              <div style={{
                fontSize: Math.round(8 * scale), fontWeight: 600, letterSpacing: '0.08em',
                color: dark ? 'rgba(245,158,11,0.5)' : '#B45309', marginTop: Math.round(3 * scale),
              }}>3-Way Round Robin</div>
            </div>
            <div style={{
              fontSize: Math.round(8 * scale), color: dark ? 'rgba(255,255,255,0.25)' : '#9CA3AF',
              textAlign: 'center', lineHeight: 1.4, fontWeight: 500,
            }}>
              3 winners · each plays 2 matches
            </div>
          </div>
        )}
        {hasTriangle && triangle.length > 0 && (<>
          {triangle[0] && <div style={{ position: 'absolute', left: finalX, top: sf1Y }}><MatchCard m={triangle[0]} dark={dark} highlight s={s} /></div>}
          {triangle[1] && <div style={{ position: 'absolute', left: finalX, top: sf2Y }}><MatchCard m={triangle[1]} dark={dark} highlight s={s} /></div>}
          {triangle[2] && <div style={{ position: 'absolute', left: finalX, top: sf3Y }}><MatchCard m={triangle[2]} dark={dark} highlight s={s} /></div>}
        </>)}
      </div>

      {/* ── Triangle round-robin section below bracket ── */}
      {hasTriangle && triangle.length > 0 && (
        <div style={{ marginTop: Math.round(24 * scale) }}>
          <TriangleSection matches={triangle} dark={dark} scale={scale} />
        </div>
      )}
    </div>
  )
}
