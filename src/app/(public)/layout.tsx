import Header from '@/components/public/Header'
import CategoryTabs from '@/components/public/CategoryTabs'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="px-10 pt-11 pb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          2026 <em className="italic">Startup Fest</em> Robotics Challenge Event Results
        </h1>
        <p className="text-sm text-gray-500">Toshkent, O&apos;zbekiston · 2026</p>
      </div>
      <div className="mx-10 mb-12 bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
        <CategoryTabs />
        {children}
      </div>
    </>
  )
}
