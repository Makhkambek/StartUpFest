import { cookies } from 'next/headers'

export interface SessionUser {
  username: string
  role: 'admin' | 'judge'
  categories: string[]
}

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

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

    // profiles table not set up — fall back to user_metadata set by seed-auth-users.ts
    const meta = user.user_metadata as { username?: string; role?: string; categories?: string[] } | null
    const role = (meta?.role ?? 'judge') as 'admin' | 'judge'
    const categories = role === 'admin' ? ['a', 'b', 'c', 'd'] : (meta?.categories ?? [])
    return { username: meta?.username ?? user.email ?? '', role, categories }
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('sfrc-mock-session')?.value
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as { username: string; role: string; categories: string[]; exp: number }
    if (Date.now() > session.exp) return null
    return { username: session.username, role: session.role as SessionUser['role'], categories: session.categories }
  } catch {
    return null
  }
}
