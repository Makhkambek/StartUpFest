import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireCategory } from '@/lib/session'
import FieldBClient from '@/components/field/FieldBClient'

export const dynamic = 'force-dynamic'

export default async function FieldBPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const auth = await requireCategory('b')
  if (!auth.ok) {
    if (auth.status === 401) redirect(`/judges/login?redirect=/${locale}/field/b`)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-3">
          <div className="text-5xl">🔒</div>
          <div className="text-xl font-black">Access Denied</div>
          <div className="text-gray-400 text-sm">You are not assigned to Category B (Mini Sumo).</div>
          <a href="/judges/dashboard" className="inline-block mt-4 text-sm text-amber-400 hover:underline">← Dashboard</a>
        </div>
      </div>
    )
  }

  return <FieldBClient />
}
