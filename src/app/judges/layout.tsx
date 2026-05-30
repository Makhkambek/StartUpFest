import { NetworkStatus } from '@/components/judges/NetworkStatus'

export default function JudgesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="judges-page">
      {children}
      <div className="fixed bottom-3 right-3 z-50 bg-white shadow-lg border border-gray-200 rounded-full px-3 py-1.5">
        <NetworkStatus />
      </div>
    </div>
  )
}
