import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | null | undefined
}

function createClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  })

  client.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[redis] connection error:', err.message)
    }
  })

  return client
}

// Reuse across hot-reloads in dev
const redis: Redis | null = globalThis._redis ?? (globalThis._redis = createClient())

export default redis
