import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export interface SessionUser {
  username: string
  role: 'admin' | 'judge'
  categories: string[]
}

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'sfrc-dev-secret-change-in-production'

export function signSession(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifySession(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const data = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString())
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, is_admin')
      .eq('id', user.id)
      .single()

    if (profile) {
      const role: 'admin' | 'judge' = profile.is_admin ? 'admin' : 'judge'
      const { data: judgeCategories } = await supabase
        .from('judge_categories')
        .select('category')
        .eq('judge_id', user.id)
      const categories = role === 'admin'
        ? ['a', 'b', 'c', 'd']
        : (judgeCategories ?? []).map((r: { category: string }) => r.category)
      return { username: profile.username, role, categories }
    }

    return null
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('sfrc-mock-session')?.value
  if (!raw) return null
  const payload = verifySession(raw)
  if (!payload) return null
  const { username, role, categories, exp } = payload as { username: string; role: string; categories: string[]; exp: number }
  if (!exp || Date.now() > exp) return null
  return { username, role: role as SessionUser['role'], categories }
}
