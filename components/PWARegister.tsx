'use client'

import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail — PWA is optional enhancement
      })
    }
  }, [])

  return null
}
