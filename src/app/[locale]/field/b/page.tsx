import { setRequestLocale } from 'next-intl/server'
import FieldBClient from '@/components/field/FieldBClient'

export const dynamic = 'force-dynamic'

export default async function FieldBPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <FieldBClient />
}
