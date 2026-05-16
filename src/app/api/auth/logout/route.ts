import { NextRequest, NextResponse } from 'next/server'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET(req: NextRequest) {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  const res = NextResponse.redirect(new URL('/judges/login', req.url))
  res.cookies.set('sfrc-mock-session', '', { maxAge: 0, path: '/', httpOnly: true })
  return res
}
