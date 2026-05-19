/**
 * Сидит 60 тестовых команд (15 × 4 категории) в Supabase teams.
 * Идемпотентно — повторный запуск не плодит дубликаты.
 *
 * Usage:
 *   npm run seed:teams
 *   # или вручную:
 *   npx tsx --env-file=.env.local scripts/seed-test-teams.ts
 *
 * Удалить все тестовые команды:
 *   npm run seed:teams -- --clean
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env vars NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: npx tsx --env-file=.env.local scripts/seed-test-teams.ts')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SCHOOLS = [
  'Maktab №1, Toshkent', 'Litsey №2, Samarqand', 'IT Kolej, Namangan',
  'Prezident Maktabi, Toshkent', 'Texnika Litsey, Buxoro', 'Raqamli Litsey, Andijon',
  "Maktab №45, Farg'ona", 'STEAM Litsey, Nukus', 'Litsey №3, Termiz',
  'IT Kolej, Qarshi', 'Fizmat Litsey, Jizzax', 'Texnopark, Navoiy',
  'Innovatsiya Maktabi, Urgench', 'Maktab №88, Toshkent', "San'at Litsey, Samarqand",
]

const NAMES = {
  a: ['LineRacer X','BlackTrack Pro','SwiftBot','Phantom Line','TrackMaster',
      'PrecisionPro','LineKnight','ZeroError','PathFinder V2','NightRider',
      'AutoLine Alpha','QuickTrace','SensorX','GridRunner','TurboPath'],
  b: ['Iron Pusher','SumoKing','RingMaster','BullBot','TitanForce',
      'BlackBull','EdgePusher','DomBot','SteelWall','ViperSumo',
      'RamBot','SumoX Pro','FortressBot','ThunderPush','IronShield'],
  c: ['Destroyer X','IronFist','WarMachine','ChaosBot','ThunderStrike',
      'VenomBot','RamPage','TitanWar','KillerBot V3','CrushMaster',
      'StormBot','BattleAxe','CyberPunch','DeathRoller','Havoc'],
  d: ['RoboFC','TechStrikers','Dynamo Bot','IronKickers','GearGoals',
      'CircuitFC','RoboUnited','ByteFC','PixelKick','BinaryFC',
      'RoboAthletic','TechMadrid','MotorCity FC','SensorSport','AutoGoal'],
} as const

const CAT_PREFIX = { a: 'aa', b: 'bb', c: 'cc', d: 'dd' } as const
const GROUPS_B = ['A','B','C','D','E','F']

function buildRows() {
  const rows: { id: string; category: 'a'|'b'|'c'|'d'; name: string; school: string; group_letter: string | null }[] = []
  for (const cat of ['a','b','c','d'] as const) {
    for (let i = 0; i < 15; i++) {
      const n = String(i + 1).padStart(12, '0')
      rows.push({
        id: `${CAT_PREFIX[cat]}000000-0000-0000-0000-${n}`,
        category: cat,
        name: `[TEST] ${NAMES[cat][i]}`,
        school: SCHOOLS[i],
        group_letter: cat === 'b' ? GROUPS_B[i % 6] : null,
      })
    }
  }
  return rows
}

async function seed() {
  const rows = buildRows()
  console.log(`Seeding ${rows.length} test teams (15 × 4 categories)…`)
  const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) { console.error('✗ Seed failed:', error.message); process.exit(1) }
  const { data, error: countErr } = await supabase
    .from('teams').select('category', { count: 'exact' }).like('name', '[TEST]%')
  if (countErr) { console.error('✗ Verify failed:', countErr.message); process.exit(1) }
  const byCat = (data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1; return acc
  }, {})
  console.log('✓ Test teams now in DB:', byCat)
  console.log('  Удалить: npm run seed:teams -- --clean')
}

async function clean() {
  console.log('Deleting all [TEST] teams…')
  const { error, count } = await supabase
    .from('teams').delete({ count: 'exact' }).like('name', '[TEST]%')
  if (error) { console.error('✗ Delete failed:', error.message); process.exit(1) }
  console.log(`✓ Deleted ${count ?? 0} test teams`)
}

if (process.argv.includes('--clean')) {
  clean()
} else {
  seed()
}
