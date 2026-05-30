import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { routing } from '@/i18n/routing'

const intl = createIntlMiddleware(routing)

function loginRedirect(request: NextRequest, redirectTo?: string): NextResponse {
  const url = new URL('/judges/login', request.url)
  if (redirectTo) url.searchParams.set('redirect', redirectTo)
  return NextResponse.redirect(url)
}

async function handleProtected(request: NextRequest, isProtectedApi: boolean, redirectTo?: string) {
  let response = NextResponse.next({ request })

  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!hasSupabase) {
    const sessionCookie = request.cookies.get('sfrc-mock-session')
    if (!sessionCookie) {
      if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return loginRedirect(request, redirectTo)
    }
    try {
      const { verifySession } = await import('@/lib/session')
      const payload = verifySession(sessionCookie.value) as { exp?: number } | null
      if (!payload?.exp || payload.exp < Date.now()) {
        if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        return loginRedirect(request, redirectTo)
      }
    } catch {
      if (isProtectedApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return loginRedirect(request, redirectTo)
    }
    return response
  }

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
    return loginRedirect(request, redirectTo)
  }

  return response
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Use strict-prefix matching so `/judges-fake` doesn't accidentally route
  // through judges auth, and `/api/judges-helper` (hypothetical) isn't gated
  // by the protected-API logic.
  const isApi = path.startsWith('/api/')
  const isJudges = path === '/judges' || path.startsWith('/judges/')
  const isDisplay = path === '/display' || path.startsWith('/display/')
  const isProtectedPage = isJudges && !path.startsWith('/judges/login')
  const isProtectedApi = path.startsWith('/api/judges/') || path.startsWith('/api/admin/')

  // ── /api/* : body size guard → rate limit → optional auth ─
  if (isApi) {
    // Cheap pre-check before we even pay for the bucket lookup. The biggest
    // legitimate POST in this app is a finals-bracket regenerate (~2 KB).
    // 16 KB is generous; anything larger is either a bug or an attempt to
    // OOM us via an inflated JSON body.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const len = parseInt(request.headers.get('content-length') ?? '0', 10)
      if (len > 16_384) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
    }
    const ip = getClientIp(request)
    const rl = await rateLimit(ip, request.method, path)
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
    if (isProtectedApi) {
      const res = await handleProtected(request, true)
      res.headers.set('X-RateLimit-Remaining', String(rl.remaining))
      return res
    }
    const res = NextResponse.next({ request })
    res.headers.set('X-RateLimit-Remaining', String(rl.remaining))
    return res
  }

  // ── /judges/* (page): auth, no locale routing ─────────────
  if (isJudges) {
    if (isProtectedPage) return handleProtected(request, false)
    return NextResponse.next({ request })
  }

  // ── /display: passthrough, no locale routing ──────────────
  if (isDisplay) return NextResponse.next({ request })

  // ── /[locale]/field/[cat]: auth required, then intl routing ─
  // Pattern: /uz/field/a, /en/field/b, etc.
  if (/^\/[a-z]{2}\/field\//.test(path)) {
    const auth = await handleProtected(request, false, path)
    // If handleProtected returns a redirect (to login), forward it
    if (auth.status === 302 || auth.status === 307 || auth.status === 308) return auth
    // Authenticated — let next-intl handle locale routing
    return intl(request)
  }

  // ── Everything else: next-intl locale routing ─────────────
  return intl(request)
}

export const config = {
  // Skip Next internals and explicit static asset extensions. The old
  // `.*\\..*` pattern excluded any path with a dot, which let requests like
  // `/api/judges/data.csv` bypass middleware authn entirely. The whitelist
  // below carves out only the static extensions we actually serve.
  matcher: [
    '/((?!_next/static|_next/image|monitoring|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)',
  ],
}
