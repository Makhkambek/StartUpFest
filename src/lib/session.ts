import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export interface SessionUser {
  username: string
  role: 'admin' | 'judge'
  categories: string[]
}

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Resolved lazily on first use rather than at module load. Next.js page-data
// collection during `npm run build` runs with NODE_ENV=production but no
// runtime secrets — a module-level throw breaks the build for any route that
// imports this file. Defer the check until sign/verify is actually called.
let _sessionSecretCache: string | null = null
function getSessionSecret(): string {
  if (_sessionSecretCache !== null) return _sessionSecretCache
  const fromEnv = process.env.SESSION_SECRET
  if (fromEnv && fromEnv.length >= 16) {
    _sessionSecretCache = fromEnv
    return fromEnv
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET env var is required in production (min 16 chars)')
  }
  _sessionSecretCache = 'sfrc-dev-secret-change-in-production'
  return _sessionSecretCache
}

export function signSession(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSessionSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifySession(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string' || token.length < 8) return null
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const data = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!data || !sig) return null
  const expected = createHmac('sha256', getSessionSecret()).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return null
  try {
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString())
  } catch {
    return null
  }
}

export type AuthzResult =
  | { ok: true; session: SessionUser }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Returns the session or an authz failure descriptor — never throws. Callers
 * convert failures to NextResponse.json(error, { status }). Used by API
 * routes to enforce role/category access at the route level (middleware only
 * authenticates; it does not authorize).
 */
export async function requireSession(): Promise<AuthzResult> {
  const session = await getSession()
  if (!session) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, session }
}

export async function requireAdmin(): Promise<AuthzResult> {
  const r = await requireSession()
  if (!r.ok) return r
  if (r.session.role !== 'admin') return { ok: false, status: 403, error: 'Admin only' }
  return r
}

export async function requireCategory(category: string): Promise<AuthzResult> {
  const r = await requireSession()
  if (!r.ok) return r
  if (r.session.role === 'admin') return r
  if (!r.session.categories.includes(category)) {
    return { ok: false, status: 403, error: `Not assigned to category ${category.toUpperCase()}` }
  }
  return r
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
