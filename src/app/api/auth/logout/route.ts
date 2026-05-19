import { NextRequest, NextResponse } from 'next/server'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/**
 * Logout is a state-changing action — must be POST (not GET) and must reject
 * cross-origin submissions. The Origin header check stops a malicious site
 * from auto-logging users out via top-level navigation or fetch.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  // Same-site requests from forms/fetch include Origin matching the request URL.
  // Reject mismatched origins outright; null Origin (some same-origin navigations)
  // is treated as ok because cookies are SameSite=Lax and only same-origin
  // top-level navigations include them.
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin logout forbidden' }, { status: 403 })
  }

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  const res = NextResponse.redirect(new URL('/judges/login', req.url), { status: 303 })
  res.cookies.set('sfrc-mock-session', '', { maxAge: 0, path: '/', httpOnly: true })
  return res
}
