import { setRequestLocale } from 'next-intl/server'
import FieldCClient from '@/components/field/FieldCClient'

export const dynamic = 'force-dynamic'

export default async function FieldCPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <FieldCClient />
}
