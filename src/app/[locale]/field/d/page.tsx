import { setRequestLocale } from 'next-intl/server'
import FieldDClient from '@/components/field/FieldDClient'

export const dynamic = 'force-dynamic'

export default async function FieldDPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <FieldDClient />
}
