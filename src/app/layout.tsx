import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SFRC 2026 — Event Results',
  description: 'Startup Fest Robotics Challenge 2026 — Live Results',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900 min-h-screen antialiased">{children}</body>
    </html>
  )
}
