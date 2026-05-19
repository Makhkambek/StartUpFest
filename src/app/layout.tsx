import type { Metadata, Viewport } from 'next'
import { getLocale, getMessages } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'SFRC 2026 — Event Results',
  description: 'Startup Fest Robotics Challenge 2026 — Live Results',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SFRC',
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-gray-100 text-gray-900 min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  )
}
