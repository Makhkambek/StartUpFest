import { NextRequest, NextResponse } from 'next/server'
import { getLiveStateA, getLiveStateB, getLiveStateC, getLiveStateD, getTeams, getResultsA } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import { isUuid } from '@/lib/uuid'
import type { ScheduledMatch } from '@/lib/schedule-store'
import type { LiveStateB, MatchB, FightC, MatchD, ResultA } from '@/types/database'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params
  if (cat === 'a') return getStateForA()
  if (cat === 'c') return getStateForC()
  if (cat === 'd') return getStateForD()
  if (cat !== 'b') {
    return NextResponse.json({ error: 'Only categories A, B, C, D supported yet' }, { status: 404 })
  }

  // Round 1 — all independent: live state + teams + city code in parallel
  const [liveState, teams, cityCode] = await Promise.all([
    getLiveStateB(),
    getTeams('b'),
    getActiveCityCode(),
  ])

  let match: ScheduledMatch | null = null
  let recordedMatch: MatchB | null = null
  let finalsData = null

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const activeId = liveState.active_match_id

    // Round 2 — parallel: active match row + active match result + finals schedule
    const [matchRes, recordedRes, finalsScheduleRes] = await Promise.all([
      activeId
        ? supabase.from('scheduled_matches').select('*').eq('id', activeId).maybeSingle()
        : Promise.resolve({ data: null }),
      activeId
        ? supabase.from('matches_b').select('*').eq('scheduled_match_id', activeId)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      liveState.finals_visible
        ? supabase.from('scheduled_matches').select('*')
            .eq('category', 'b').eq('city_code', cityCode).eq('phase', 'finals')
        : Promise.resolve({ data: [] }),
    ])

    match = (matchRes.data as ScheduledMatch | null) ?? null
    recordedMatch = (recordedRes.data as MatchB | null) ?? null
    const finalsSchedule = (finalsScheduleRes.data as ScheduledMatch[] | null) ?? []

    // Round 3 — finals results (only if finals matches exist)
    if (finalsSchedule.length > 0) {
      const ids = finalsSchedule.map((m) => m.id)
      const { data: mb } = await supabase.from('matches_b').select('*').in('scheduled_match_id', ids)
      const matchesB = (mb as MatchB[] | null) ?? []
      const tName = (id: string | null) => id ? teams.find((t) => t.id === id)?.name ?? null : null
      const tSchool = (id: string | null) => id ? teams.find((t) => t.id === id)?.school ?? null : null
      finalsData = finalsSchedule.map((fm) => {
        const result = matchesB.find((r) => r.scheduled_match_id === fm.id) ?? null
        return {
          match_id: fm.match_id,
          status: fm.status,
          red: { id: fm.team1_id, name: tName(fm.team1_id), school: tSchool(fm.team1_id) },
          white: fm.team2_id ? { id: fm.team2_id, name: tName(fm.team2_id), school: tSchool(fm.team2_id) } : null,
          winner: result?.winner ?? null,
          rounds1: result?.rounds1 ?? null,
          rounds2: result?.rounds2 ?? null,
        }
      })
    }
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    const list = getSchedule('b')
    if (liveState.active_match_id) {
      match = list.find((m) => m.id === liveState.active_match_id) ?? null
      if (match) {
        const { getMatchesB } = await import('@/lib/mock-store')
        const all = getMatchesB()
        recordedMatch = all.find((r) => r.scheduled_match_id === match!.id)
          ?? all.find((r) =>
              !r.scheduled_match_id &&
              ((r.team1_id === match!.team1_id && r.team2_id === match!.team2_id) ||
               (r.team1_id === match!.team2_id && r.team2_id === match!.team1_id))
            )
          ?? null
      }
    }
    if (liveState.finals_visible) {
      const finalsSchedule = list.filter((m) => (m as ScheduledMatch & { phase?: string }).phase === 'finals')
      const { getMatchesB } = await import('@/lib/mock-store')
      const matchesB = getMatchesB()
      const tName = (id: string | null) => id ? teams.find((t) => t.id === id)?.name ?? null : null
      const tSchool = (id: string | null) => id ? teams.find((t) => t.id === id)?.school ?? null : null
      finalsData = finalsSchedule.map((fm) => {
        const result = matchesB.find((r) => r.scheduled_match_id === fm.id) ?? null
        return {
          match_id: fm.match_id,
          status: fm.status,
          red: { id: fm.team1_id, name: tName(fm.team1_id), school: tSchool(fm.team1_id) },
          white: fm.team2_id ? { id: fm.team2_id, name: tName(fm.team2_id), school: tSchool(fm.team2_id) } : null,
          winner: result?.winner ?? null,
          rounds1: result?.rounds1 ?? null,
          rounds2: result?.rounds2 ?? null,
        }
      })
    }
  }

  // Overlay recordedMatch on live state so direct DB edits propagate to field.
  const state: LiveStateB = recordedMatch && match
    ? mergeRecordedIntoState(liveState, match, recordedMatch)
    : liveState

  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? null : null
  const teamSchool = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.school ?? null : null

  return NextResponse.json({
    state,
    match,
    red: match
      ? { id: match.team1_id, name: teamName(match.team1_id), school: teamSchool(match.team1_id) }
      : null,
    white: match
      ? { id: match.team2_id, name: teamName(match.team2_id), school: teamSchool(match.team2_id) }
      : null,
    finalsData,
  })
}

// ── Category A · Line Follower ────────────────────────────────────────
async function getStateForA() {
  const [liveState, teams, results, cityCode] = await Promise.all([
    getLiveStateA(),
    getTeams('a'),
    getResultsA(),
    getActiveCityCode(),
  ])

  // Compute leaderboard — all teams with a recorded time.
  const standings = computeStandingsA(teams, results)
  const leaderboard = standings
    .filter((s) => s.total !== null)
    .map((s) => ({ rank: s.rank, name: s.team.name, school: s.team.school, time: s.total, penalty: s.penalty }))

  let match: ScheduledMatch | null = null
  let allSchedule: ScheduledMatch[] = []
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: all } = await supabase
      .from('scheduled_matches')
      .select('*')
      .eq('category', 'a')
      .eq('city_code', cityCode)
    allSchedule = (all as ScheduledMatch[] | null) ?? []
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
    }
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    allSchedule = getSchedule('a')
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
    }
  }

  // Find "next" match for the field preview: a waiting match takes priority,
  // otherwise the first pending one. Skip the currently active match.
  const sortedSchedule = [...allSchedule].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
  const nextSched =
    sortedSchedule.find((m) => m.status === 'waiting' && m.id !== liveState.active_match_id)
    ?? sortedSchedule.find((m) => m.status === 'pending' && m.id !== liveState.active_match_id)
    ?? null

  const teamId = match?.team1_id ?? null
  const team = teamId ? teams.find((t) => t.id === teamId) ?? null : null
  const teamResult = teamId ? results.find((r) => r.team_id === teamId) ?? null : null
  const bestTime = teamResult?.total ?? null
  // If judge edited a completed run, override the display time from results_a
  const activeResult = match?.id ? results.find(r => r.scheduled_match_id === match!.id) ?? null : null
  const recordedTime: number | null = activeResult?.total ?? null

  // Build next preview (team + best time for the next runner)
  const nextTeamId = nextSched?.team1_id ?? null
  const nextTeam = nextTeamId ? teams.find((t) => t.id === nextTeamId) ?? null : null
  const nextTeamResult = nextTeamId ? results.find((r) => r.team_id === nextTeamId) ?? null : null
  const nextRun = nextSched
    ? {
        match_id: nextSched.match_id,
        status: nextSched.status,
        team: nextTeam ? { id: nextTeam.id, name: nextTeam.name, school: nextTeam.school } : null,
        bestTime: nextTeamResult?.total ?? null,
      }
    : null

  // ── Finals bracket data ──────────────────────────────────────────────
  let finalsData = null
  if (liveState.finals_visible) {
    const finalsMatches = allSchedule.filter((m) => (m as ScheduledMatch & { phase?: string }).phase === 'finals')
    const finalsResults: Record<string, ResultA | null> = {}
    for (const fm of finalsMatches) {
      const r = results.find((res) => res.scheduled_match_id === fm.id) ?? null
      finalsResults[fm.id] = r
    }
    finalsData = finalsMatches.map((fm) => {
      const t = teams.find((t) => t.id === fm.team1_id)
      const res = finalsResults[fm.id]
      return {
        match_id: fm.match_id,
        status: fm.status,
        team: t ? { id: t.id, name: t.name, school: t.school } : null,
        time: res?.total ?? null,
        penalty: res?.penalty ?? null,
      }
    })
  }

  return NextResponse.json({
    state: liveState,
    match,
    team: team
      ? { id: team.id, name: team.name, school: team.school }
      : null,
    bestTime,
    recordedTime,
    leaderboard,
    nextRun,
    finalsData,
  })
}

// ── Category C · MiniRoboWar ──────────────────────────────────────────
async function getStateForC() {
  const [liveState, teams, cityCode] = await Promise.all([
    getLiveStateC(),
    getTeams('c'),
    getActiveCityCode(),
  ])

  let match: ScheduledMatch | null = null
  let recordedFight: FightC | null = null
  let allSchedule: ScheduledMatch[] = []
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: all } = await supabase.from('scheduled_matches').select('*')
      .eq('category', 'c').eq('city_code', cityCode)
    allSchedule = (all as ScheduledMatch[] | null) ?? []
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
      if (match) {
        const { data: rf } = await supabase.from('fights_c').select('*')
          .eq('scheduled_match_id', match.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        recordedFight = (rf as FightC | null) ?? null
      }
    }
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    allSchedule = getSchedule('c')
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
      if (match) {
        const { getFightsC } = await import('@/lib/mock-store')
        const all = getFightsC()
        recordedFight = all.find((r) => r.scheduled_match_id === match!.id)
          ?? all.find((r) =>
              !r.scheduled_match_id &&
              ((r.team1_id === match!.team1_id && r.team2_id === match!.team2_id) ||
               (r.team1_id === match!.team2_id && r.team2_id === match!.team1_id))
            )
          ?? null
      }
    }
  }

  const sortedSchedule = [...allSchedule].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
  const nextSched =
    sortedSchedule.find((m) => m.status === 'waiting' && m.id !== liveState.active_match_id)
    ?? sortedSchedule.find((m) => m.status === 'pending' && m.id !== liveState.active_match_id)
    ?? null

  const state = recordedFight && match
    ? mergeRecordedIntoStateC(liveState, match, recordedFight)
    : liveState

  const teamName = (id: string | null) => id ? teams.find((t) => t.id === id)?.name ?? null : null
  const teamSchool = (id: string | null) => id ? teams.find((t) => t.id === id)?.school ?? null : null

  const red = match ? { id: match.team1_id, name: teamName(match.team1_id), school: teamSchool(match.team1_id) } : null
  const white = match && match.team2_id
    ? { id: match.team2_id, name: teamName(match.team2_id), school: teamSchool(match.team2_id) }
    : null

  // Build nextMatch preview
  const nextRed = nextSched ? { id: nextSched.team1_id, name: teamName(nextSched.team1_id), school: teamSchool(nextSched.team1_id) } : null
  const nextWhite = nextSched && nextSched.team2_id ? { id: nextSched.team2_id, name: teamName(nextSched.team2_id), school: teamSchool(nextSched.team2_id) } : null

  // ── Finals data (Cat C = SE bracket: SF → Final + 3rd) ───────────────
  let finalsData = null
  if (liveState.finals_visible) {
    let finalsSchedule: ScheduledMatch[] = []
    let fightsC: FightC[] = []
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: fs } = await supabase.from('scheduled_matches').select('*')
        .eq('category', 'c').eq('city_code', cityCode).eq('phase', 'finals')
      finalsSchedule = (fs as ScheduledMatch[] | null) ?? []
      if (finalsSchedule.length > 0) {
        const ids = finalsSchedule.map(m => m.id)
        const { data: fc } = await supabase.from('fights_c').select('*').in('scheduled_match_id', ids)
        fightsC = (fc as FightC[] | null) ?? []
      }
    } else {
      const { getSchedule } = await import('@/lib/schedule-store')
      finalsSchedule = getSchedule('c').filter(m => (m as ScheduledMatch & { phase?: string }).phase === 'finals')
      const { getFightsC: getMockFights } = await import('@/lib/mock-store')
      fightsC = getMockFights()
    }
    const teamName = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? null : null
    const teamSchool = (id: string | null) => id ? teams.find(t => t.id === id)?.school ?? null : null
    finalsData = finalsSchedule.map(fm => {
      const result = fightsC.find(f => f.scheduled_match_id === fm.id) ?? null
      return {
        match_id: fm.match_id,
        status: fm.status,
        red:   { id: fm.team1_id, name: teamName(fm.team1_id), school: teamSchool(fm.team1_id) },
        white: fm.team2_id ? { id: fm.team2_id, name: teamName(fm.team2_id), school: teamSchool(fm.team2_id) } : null,
        winner: result?.winner ?? null,
        rounds1: result?.judge_score1 ?? null,
        rounds2: result?.judge_score2 ?? null,
      }
    })
  }

  return NextResponse.json({
    state,
    match,
    red,
    white,
    nextMatch: nextSched ? { match_id: nextSched.match_id, status: nextSched.status, red: nextRed, white: nextWhite } : null,
    finalsData,
  })
}

// ── Category D · Robo Football ──────────────────────────────────────
async function getStateForD() {
  const [liveState, teams, cityCode] = await Promise.all([getLiveStateD(), getTeams('d'), getActiveCityCode()])

  let match: ScheduledMatch | null = null
  let recordedMatchD: MatchD | null = null
  let allSchedule: ScheduledMatch[] = []
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: all } = await supabase.from('scheduled_matches').select('*')
      .eq('category', 'd').eq('city_code', cityCode)
    allSchedule = (all as ScheduledMatch[] | null) ?? []
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
      if (match) {
        const { data: rd } = await supabase.from('matches_d').select('*')
          .eq('scheduled_match_id', match.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        recordedMatchD = (rd as MatchD | null) ?? null
      }
    }
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    allSchedule = getSchedule('d')
    if (liveState.active_match_id) {
      match = allSchedule.find((m) => m.id === liveState.active_match_id) ?? null
      if (match) {
        const { getMatchesD } = await import('@/lib/mock-store')
        const all = getMatchesD()
        recordedMatchD = all.find((r) => r.scheduled_match_id === match!.id)
          ?? all.find((r) =>
              !r.scheduled_match_id &&
              ((r.team1_id === match!.team1_id && r.team2_id === match!.team2_id) ||
               (r.team1_id === match!.team2_id && r.team2_id === match!.team1_id))
            )
          ?? null
      }
    }
  }

  const sortedSchedule = [...allSchedule].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
  const nextSched =
    sortedSchedule.find((m) => m.status === 'waiting' && m.id !== liveState.active_match_id)
    ?? sortedSchedule.find((m) => m.status === 'pending' && m.id !== liveState.active_match_id)
    ?? null

  const state = recordedMatchD && match
    ? mergeRecordedIntoStateD(liveState, match, recordedMatchD)
    : liveState

  const teamName = (id: string | null | undefined) => id ? teams.find((t) => t.id === id)?.name ?? null : null
  const teamSchool = (id: string | null | undefined) => id ? teams.find((t) => t.id === id)?.school ?? null : null
  const teamAllianceName = (id: string | null | undefined) => id ? teams.find((t) => t.id === id)?.alliance_name ?? null : null
  const teamLite = (id: string | null | undefined) =>
    id ? { id, name: teamName(id), school: teamSchool(id), alliance_name: teamAllianceName(id) } : null

  const red = match ? teamLite(match.team1_id) : null
  const redPartner = match ? teamLite(match.team1b_id) : null
  const white = match && match.team2_id ? teamLite(match.team2_id) : null
  const whitePartner = match ? teamLite(match.team2b_id) : null

  const nextRed = nextSched ? teamLite(nextSched.team1_id) : null
  const nextRedPartner = nextSched ? teamLite(nextSched.team1b_id) : null
  const nextWhite = nextSched && nextSched.team2_id ? teamLite(nextSched.team2_id) : null
  const nextWhitePartner = nextSched ? teamLite(nextSched.team2b_id) : null

  // ── Finals data (Cat D = 3-alliance round-robin) ─────────────────────
  let finalsData = null
  if (liveState.finals_visible) {
    const finalsMatches = allSchedule.filter((m) => (m as ScheduledMatch & { phase?: string }).phase === 'finals')
    let matchesD: import('@/types/database').MatchD[] = []
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const ids = finalsMatches.map((m) => m.id)
      if (ids.length > 0) {
        const { data } = await supabase.from('matches_d').select('*').in('scheduled_match_id', ids)
        matchesD = (data ?? []) as import('@/types/database').MatchD[]
      }
    } else {
      const { getMatchesD } = await import('@/lib/mock-store')
      matchesD = getMatchesD()
    }
    finalsData = finalsMatches.map((fm) => {
      const result = matchesD.find((r) => r.scheduled_match_id === fm.id) ?? null
      return {
        match_id: fm.match_id,
        status: fm.status,
        red: teamLite(fm.team1_id),
        redPartner: teamLite(fm.team1b_id),
        white: teamLite(fm.team2_id),
        whitePartner: teamLite(fm.team2b_id),
        goals1: result?.goals1 ?? null,
        goals2: result?.goals2 ?? null,
      }
    })
  }

  return NextResponse.json({
    state,
    match,
    red,
    redPartner,
    white,
    whitePartner,
    nextMatch: nextSched ? {
      match_id: nextSched.match_id,
      status: nextSched.status,
      red: nextRed,
      redPartner: nextRedPartner,
      white: nextWhite,
      whitePartner: nextWhitePartner,
    } : null,
    finalsData,
  })
}

function mergeRecordedIntoState(live: LiveStateB, sched: ScheduledMatch, rec: MatchB): LiveStateB {
  // recordedMatch.team1_id/team2_id might be swapped vs scheduled (judge entered in different order).
  // Always present results aligned with scheduled (team1 = red, team2 = white).
  const swap = rec.team1_id !== sched.team1_id
  const wins_red = swap ? rec.rounds2 : rec.rounds1
  const wins_white = swap ? rec.rounds1 : rec.rounds2
  const match_winner =
    rec.winner === 0 ? 0
    : rec.winner === 1 ? (swap ? 2 : 1)
    : (swap ? 1 : 2)

  // If live state is still mid-match (e.g. judge wrote via Record form without using LIVE control),
  // promote to match_result so field shows the final outcome. If the live UI is
  // already showing match_result/idle, leave it alone — overwriting would
  // restart the result animation. Otherwise force the result phase.
  const phase: LiveStateB['phase'] =
    live.phase === 'match_result' || live.phase === 'idle' ? live.phase : 'match_result'

  return {
    ...live,
    phase,
    wins_red,
    wins_white,
    match_winner: match_winner as LiveStateB['match_winner'],
    starting_position: rec.starting_position ?? live.starting_position,
  }
}

function mergeRecordedIntoStateC(live: LiveStateB, sched: ScheduledMatch, rec: FightC): LiveStateB {
  // wins_red/white in Cat C = judge scores (0-100). Align with scheduled team order.
  const swap = rec.team1_id !== sched.team1_id
  const wins_red = swap ? rec.judge_score2 : rec.judge_score1
  const wins_white = swap ? rec.judge_score1 : rec.judge_score2
  const match_winner: LiveStateB['match_winner'] = rec.winner === 1 ? (swap ? 2 : 1) : (swap ? 1 : 2)
  const phase: LiveStateB['phase'] =
    live.phase === 'match_result' || live.phase === 'idle' ? live.phase : 'match_result'
  return { ...live, phase, wins_red, wins_white, match_winner }
}

function mergeRecordedIntoStateD(live: LiveStateB, sched: ScheduledMatch, rec: MatchD): LiveStateB {
  // wins_red/white in Cat D = goals1/goals2. Align with scheduled team order.
  const swap = rec.team1_id !== sched.team1_id
  const wins_red = swap ? rec.goals2 : rec.goals1
  const wins_white = swap ? rec.goals1 : rec.goals2
  const match_winner: LiveStateB['match_winner'] =
    wins_red > wins_white ? 1 : wins_white > wins_red ? 2 : 0
  const phase: LiveStateB['phase'] =
    live.phase === 'match_result' || live.phase === 'idle' ? live.phase : 'match_result'
  return { ...live, phase, wins_red, wins_white, match_winner }
}
