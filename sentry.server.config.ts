import * as Sentry from '@sentry/nextjs'

function stripSensitive(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Remove cookies and authorization headers before the event leaves the server.
  if (event.request) {
    if (event.request.cookies) delete event.request.cookies
    if (event.request.headers) {
      delete event.request.headers.authorization
      delete (event.request.headers as Record<string, unknown>).Authorization
      delete event.request.headers.cookie
      delete (event.request.headers as Record<string, unknown>).Cookie
    }
  }
  return event
}

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    beforeSend: stripSensitive,
  })
}
