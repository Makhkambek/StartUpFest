import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const path = request.nextUrl.pathname
  const isJudgesRoute = path.startsWith('/judges') && !path.startsWith('/judges/login')

  if (!isJudgesRoute) return response

  // ── Mock mode (no Supabase) ──────────────────────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sessionCookie = request.cookies.get('sfrc-mock-session')
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/judges/login', request.url))
    }
    try {
      const session = JSON.parse(sessionCookie.value)
      if (!session?.exp || session.exp < Date.now()) {
        return NextResponse.redirect(new URL('/judges/login', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/judges/login', request.url))
    }
    return response
  }

  // ── Supabase mode ────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/judges/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/judges/:path*', '/api/admin/:path*'],
}
