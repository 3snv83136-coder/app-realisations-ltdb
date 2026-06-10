'use client'

import { useEffect, useRef } from "react"

/**
 * Empêche la mise en veille de l'écran pendant les opérations longues (iOS / Android).
 * Se réactive au retour sur l'app après verrouillage.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) {
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
      return
    }

    let cancelled = false

    async function acquire() {
      if (cancelled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return
      try {
        lockRef.current?.release().catch(() => {})
        lockRef.current = await navigator.wakeLock.request("screen")
      } catch {
        /* refusé ou non supporté */
      }
    }

    void acquire()

    function onVisibility() {
      if (document.visibilityState === "visible" && active && !cancelled) {
        void acquire()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [active])
}
