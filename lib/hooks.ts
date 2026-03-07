import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

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
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const urlRef = useRef(url)
  urlRef.current = url

  const doFetch = useCallback(async (fetchUrl: string, isBackground: boolean) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await fetch(fetchUrl)
      const json = await res.json()
      if (res.ok) {
        fetchCache.set(fetchUrl, { data: json, ts: Date.now() })
        if (urlRef.current === fetchUrl) {
          setData(json)
        }
      }
    } catch {
      // Network error — keep existing data
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
      if (Date.now() - cached.ts > ttl) {
        doFetch(url, true)
      }
    } else {
      doFetch(url, false)
    }
  }, [url, ttl, doFetch])

  return { data, loading, refresh }
}

// Barcode scanner hook — detects rapid keystrokes ending with Enter
export function useBarcodeScan(onScan: (code: string) => void) {
  const bufferRef = useRef('')
  const lastKeyTime = useRef(0)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const now = Date.now()
      const timeDiff = now - lastKeyTime.current

      if (timeDiff > 100) {
        // Too slow — reset buffer (human typing)
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim()
        if (code.length >= 6) {
          onScanRef.current(code)
        }
        bufferRef.current = ''
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
      }

      lastKeyTime.current = now
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
