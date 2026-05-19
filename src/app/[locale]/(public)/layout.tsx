import { getTranslations, setRequestLocale } from 'next-intl/server'
import Header from '@/components/public/Header'
import CategoryTabs from '@/components/public/CategoryTabs'

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'publicLayout' })

  return (
    <>
      <Header />
      <div className="px-4 sm:px-10 pt-6 sm:pt-11 pb-6 sm:pb-8">
        <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          {t.rich('title', { em: (chunks) => <em className="italic">{chunks}</em> })}
        </h1>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <div className="mx-3 sm:mx-10 mb-8 sm:mb-12 bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
        <CategoryTabs />
        {children}
      </div>
    </>
  )
}
