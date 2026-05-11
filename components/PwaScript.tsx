'use client'

import { useEffect } from 'react'

export function PwaScript() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silencieux — le site fonctionne sans service worker
      })
    }
  }, [])

  return null
}
