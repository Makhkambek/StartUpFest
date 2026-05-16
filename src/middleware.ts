import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const path = request.nextUrl.pathname
  const isProtectedPage = path.startsWith('/judges') && !path.startsWith('/judges/login')
  const isProtectedApi = path.startsWith('/api/judges') || path.startsWith('/api/admin')
  const isAnyApi = path.startsWith('/api/')

  // ── Rate limiting for all /api/* routes ──────────────────
  if (isAnyApi) {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, request.method)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
            'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          },
        },
      )
    }
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
  }

  if (!isProtectedPage && !isProtectedApi) return response

  // ── Mock mode (no Supabase) ──────────────────────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sessionCookie = request.cookies.get('sfrc-mock-session')
    if (!sessionCookie) {
      if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return NextResponse.redirect(new URL('/judges/login', request.url))
    }
    try {
      const { verifySession } = await import('@/lib/session')
      const payload = verifySession(sessionCookie.value) as { exp?: number } | null
      if (!payload?.exp || payload.exp < Date.now()) {
        if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        return NextResponse.redirect(new URL('/judges/login', request.url))
      }
    } catch {
      if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/judges/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/judges/:path*', '/api/:path*'],
}
