'use client'
import { useEffect, useState } from 'react'

export function NetworkStatus() {
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)

  useEffect(() => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine)

    const onOnline = () => { setOnline(true); flushQueue() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // initial queue read
    refreshQueueCount()
    const interval = setInterval(refreshQueueCount, 5000)

    // register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null)
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function refreshQueueCount() {
    try {
      const raw = localStorage.getItem('sfrc-offline-queue')
      const queue = raw ? JSON.parse(raw) as unknown[] : []
      setQueuedCount(queue.length)
    } catch { setQueuedCount(0) }
  }

  async function flushQueue() {
    try {
      const raw = localStorage.getItem('sfrc-offline-queue')
      if (!raw) return
      const queue = JSON.parse(raw) as Array<{ url: string; method: string; body: string }>
      const remaining: typeof queue = []
      for (const item of queue) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: item.body,
          })
          if (!res.ok) remaining.push(item)
        } catch { remaining.push(item) }
      }
      localStorage.setItem('sfrc-offline-queue', JSON.stringify(remaining))
      refreshQueueCount()
    } catch { /* noop */ }
  }

  if (online && queuedCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-gray-400 dark:text-zinc-400">Online</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded ${online ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'}`}>
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}></span>
      <span className="font-bold">{online ? 'Syncing' : 'Offline'}</span>
      {queuedCount > 0 && <span className="font-mono">· {queuedCount} queued</span>}
    </span>
  )
}
