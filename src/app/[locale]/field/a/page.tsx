import { setRequestLocale } from 'next-intl/server'
import FieldAClient from '@/components/field/FieldAClient'

export const dynamic = 'force-dynamic'

export default async function FieldAPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <FieldAClient />
}
