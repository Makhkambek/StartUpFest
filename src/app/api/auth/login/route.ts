import { NextRequest, NextResponse } from 'next/server'

// Mock credentials for dev (no Supabase)
const MOCK_USERS: Record<string, { password: string; role: string; categories: string[] }> = {
  admin:     { password: 'admin1',          role: 'admin', categories: ['a','b','c','d'] },
  judge_a1:  { password: 'Line@Track#2026', role: 'judge', categories: ['a'] },
  judge_a2:  { password: 'Fast@Racer#2026', role: 'judge', categories: ['a'] },
  judge_b1:  { password: 'Sumo@Ring#2026',  role: 'judge', categories: ['b'] },
  judge_b2:  { password: 'Push@Bull#2026',  role: 'judge', categories: ['b'] },
  judge_c1:  { password: 'War@Bot#2026',    role: 'judge', categories: ['c'] },
  judge_c2:  { password: 'Fight@KO#2026',   role: 'judge', categories: ['c'] },
  judge_d1:  { password: 'Goal@Kick#2026',  role: 'judge', categories: ['d'] },
  judge_d2:  { password: 'Robo@FC#2026',    role: 'judge', categories: ['d'] },
}

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  // ── Supabase mode ──────────────────────────────────────
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const email = `${username.trim().toLowerCase()}@sfrc.local`
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    return NextResponse.json({ ok: true })
  }

  // ── Mock mode (no Supabase) ────────────────────────────
  const user = MOCK_USERS[username?.trim().toLowerCase()]
  if (!user || user.password !== password) {
    await new Promise(r => setTimeout(r, 600)) // prevent brute force timing
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const session = { username: username.toLowerCase(), role: user.role, categories: user.categories, exp: Date.now() + 2 * 60 * 60 * 1000 }
  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set('sfrc-mock-session', JSON.stringify(session), {
    httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 2,
  })
  return res
}
