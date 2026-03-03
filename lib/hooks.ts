import { useState, useEffect, useRef, useCallback } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Simple stale-while-revalidate cache
const fetchCache = new Map<string, { data: unknown; ts: number }>()

export function useFetchWithCache<T>(url: string | null, ttl = 30000): {
  data: T | null
  loading: boolean
  refresh: () => void
} {
  const [data, setData] = useState<T | null>(() => {
    if (!url) return null
    const cached = fetchCache.get(url)
    return cached ? (cached.data as T) : null
  })
  const [loading, setLoading] = useState(() => {
    if (!url) return false
    return !fetchCache.has(url)
  })
  const urlRef = useRef(url)
  urlRef.current = url

  const doFetch = useCallback(async (fetchUrl: string, isBackground: boolean) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await fetch(fetchUrl)
      const json = await res.json()
      fetchCache.set(fetchUrl, { data: json, ts: Date.now() })
      if (urlRef.current === fetchUrl) {
        setData(json)
      }
    } finally {
      if (urlRef.current === fetchUrl) {
        setLoading(false)
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (url) {
      fetchCache.delete(url)
      doFetch(url, false)
    }
  }, [url, doFetch])

  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return }

    const cached = fetchCache.get(url)
    if (cached) {
      setData(cached.data as T)
      setLoading(false)
      // Background revalidate if stale
      if (Date.now() - cached.ts > ttl) {
        doFetch(url, true)
      }
    } else {
      doFetch(url, false)
    }
  }, [url, ttl, doFetch])

  return { data, loading, refresh }
}
