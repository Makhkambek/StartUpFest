import type { Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'

const SCHOOLS = [
  'Maktab №1, Toshkent', 'Litsey №2, Samarqand', 'IT Kolej, Namangan',
  'Prezident Maktabi, Toshkent', 'Texnika Litsey, Buxoro', 'Raqamli Litsey, Andijon',
  'Maktab №45, Farg\'ona', 'STEAM Litsey, Nukus', 'Litsey №3, Termiz',
  'IT Kolej, Qarshi', 'Fizmat Litsey, Jizzax', 'Texnopark, Navoiy',
  'Innovatsiya Maktabi, Urgench', 'Maktab №88, Toshkent', 'San\'at Litsey, Samarqand',
  'Robototexnika Litsey, Namangan', 'Smart School, Toshkent', 'Maktab №12, Buxoro',
  'Texnologiya Kolej, Andijon', 'Kreativ Litsey, Farg\'ona',
]

function makeTeams(category: string, names: string[]): Team[] {
  return names.map((name, i) => ({
    id: `${category}-${i + 1}`,
    category: category as Team['category'],
    name,
    school: SCHOOLS[i],
    group_letter: category === 'b' ? ['A','B','C','D','E','F'][i % 6] : null,
    created_at: '2026-05-11T00:00:00Z',
  }))
}

export const MOCK_TEAMS_A = makeTeams('a', [
  'LineRacer X','BlackTrack Pro','SwiftBot','Phantom Line','TrackMaster',
  'PrecisionPro','LineKnight','ZeroError','PathFinder V2','NightRider',
  'AutoLine Alpha','QuickTrace','SensorX','GridRunner','TurboPath',
  'AccuBot','SilverLine','SpeedDemon','TrackHunter','MicroLine',
])

export const MOCK_TEAMS_B = makeTeams('b', [
  'Iron Pusher','SumoKing','RingMaster','BullBot','TitanForce',
  'BlackBull','EdgePusher','DomBot','SteelWall','ViperSumo',
  'RamBot','SumoX Pro','FortressBot','ThunderPush','IronShield',
  'ZenBot','SumoStrike','BearBot','WallBreaker','PushPrime',
])

export const MOCK_TEAMS_C = makeTeams('c', [
  'Destroyer X','IronFist','WarMachine','ChaosBot','ThunderStrike',
  'VenomBot','RamPage','TitanWar','KillerBot V3','CrushMaster',
  'StormBot','BattleAxe','CyberPunch','DeathRoller','Havoc',
  'ShredBot','BladeRunner','TerrorBot','MaxDamage','IronJaw',
])

export const MOCK_TEAMS_D = makeTeams('d', [
  'RoboFC','TechStrikers','Dynamo Bot','IronKickers','GearGoals',
  'CircuitFC','RoboUnited','ByteFC','PixelKick','BinaryFC',
  'RoboAthletic','TechMadrid','MotorCity FC','SensorSport','AutoGoal',
  'BotBarca','RoboJuve','ChipKick','RoboChelsea','WheelFC',
])

export function getMockResultsA(): ResultA[] {
  return MOCK_TEAMS_A.map((t, i) => {
    if (i === 18) return { scheduled_match_id: null, team_id: t.id, run1: null, run2: null, penalty: 'dnf' as ResultA['penalty'], total: null, notes: null, run_phase: 'qualification' as ResultA['run_phase'], updated_at: '' }
    if (i === 19) return { scheduled_match_id: null, team_id: t.id, run1: null, run2: null, penalty: 'disq' as ResultA['penalty'], total: null, notes: null, run_phase: 'qualification' as ResultA['run_phase'], updated_at: '' }
    const base = 22 + i * 5.1
    const r1 = +(Math.max(18, base + (Math.random() * 6 - 3))).toFixed(2)
    const r2 = +(Math.max(18, base + (Math.random() * 6 - 3))).toFixed(2)
    const pen = (i > 7 && Math.random() > 0.5) ? '20' : '0'
    return { scheduled_match_id: null, team_id: t.id, run1: r1, run2: r2, penalty: pen as ResultA['penalty'], total: +((r1 + r2) / 2 + parseInt(pen)).toFixed(2), notes: null, run_phase: 'qualification' as ResultA['run_phase'], updated_at: '' }
  })
}

export function getMockMatchesB(): MatchB[] {
  const matches: MatchB[] = []
  for (let i = 0; i < MOCK_TEAMS_B.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, MOCK_TEAMS_B.length); j++) {
      const winner = Math.random() > 0.2 ? (Math.random() > 0.5 ? 1 : 2) : 0
      matches.push({ id: `b-match-${i}-${j}`, match_number: matches.length + 1, team1_id: MOCK_TEAMS_B[i].id, team2_id: MOCK_TEAMS_B[j].id, winner: winner as 0 | 1 | 2, rounds1: winner === 1 ? 2 : winner === 0 ? 1 : 0, rounds2: winner === 2 ? 2 : winner === 0 ? 1 : 0, starting_position: 'face', notes: null, created_at: '' })
    }
  }
  return matches
}

export function getMockFightsC(): FightC[] {
  const methods: FightC['method'][] = ['KO', 'IMM', 'JD']
  return MOCK_TEAMS_C.flatMap((t, i) =>
    MOCK_TEAMS_C.slice(i + 1, i + 4).map((t2, j) => ({
      id: `c-fight-${i}-${j}`,
      fight_number: i * 3 + j + 1,
      team1_id: t.id, team2_id: t2.id,
      winner: (Math.random() > 0.5 ? 1 : 2) as 1 | 2,
      method: methods[Math.floor(Math.random() * 3)],
      judge_score1: 60 + Math.floor(Math.random() * 40),
      judge_score2: 60 + Math.floor(Math.random() * 40),
      notes: null,
      created_at: '',
    }))
  )
}

export function getMockMatchesD(): MatchD[] {
  return MOCK_TEAMS_D.flatMap((t, i) =>
    MOCK_TEAMS_D.slice(i + 1, i + 4).map((t2, j) => {
      const g1 = Math.floor(Math.random() * 5)
      const g2 = Math.floor(Math.random() * 5)
      return { id: `d-match-${i}-${j}`, match_number: i * 3 + j + 1, team1_id: t.id, team2_id: t2.id, goals1: g1, goals2: g2, match_phase: 'group' as const, notes: null, created_at: '' }
    })
  )
}
