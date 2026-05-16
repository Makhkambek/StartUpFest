import { NetworkStatus } from '@/components/judges/NetworkStatus'
import { ThemeProvider } from '@/components/judges/ThemeProvider'

export default function JudgesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="judges-page">
        {children}
        <div className="fixed bottom-3 right-3 z-50 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
          <NetworkStatus />
        </div>
      </div>
    </ThemeProvider>
  )
}
