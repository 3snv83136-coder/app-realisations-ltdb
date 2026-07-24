'use client'

import { useEffect, useRef } from "react"

/**
 * Empêche la mise en veille de l'écran (iPhone / Android) tant que `active`.
 * 1. Screen Wake Lock API (Safari iOS 16.4+)
 * 2. Repli : vidéo muette en boucle (comme pendant une lecture vidéo)
 * Se réactive au retour sur l'onglet / l'app.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!active) {
      void releaseAll(lockRef, videoRef)
      return
    }

    let cancelled = false

    async function acquire() {
      if (cancelled || typeof document === "undefined") return
      if (document.visibilityState !== "visible") return

      if ("wakeLock" in navigator) {
        try {
          try {
            await lockRef.current?.release()
          } catch {
            /* ignore */
          }
          lockRef.current = await navigator.wakeLock.request("screen")
          stopVideoFallback(videoRef)
          return
        } catch {
          /* refusé / non supporté → repli vidéo */
        }
      }

      ensureVideoFallback(videoRef)
    }

    void acquire()

    function onVisibility() {
      if (document.visibilityState === "visible" && !cancelled) {
        void acquire()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      void releaseAll(lockRef, videoRef)
    }
  }, [active])
}

function stopVideoFallback(videoRef: { current: HTMLVideoElement | null }) {
  const v = videoRef.current
  if (!v) return
  try {
    v.pause()
    v.removeAttribute("src")
    v.load()
    v.remove()
  } catch {
    /* ignore */
  }
  videoRef.current = null
}

async function releaseAll(
  lockRef: { current: WakeLockSentinel | null },
  videoRef: { current: HTMLVideoElement | null },
) {
  try {
    await lockRef.current?.release()
  } catch {
    /* ignore */
  }
  lockRef.current = null
  stopVideoFallback(videoRef)
}

function ensureVideoFallback(videoRef: { current: HTMLVideoElement | null }) {
  if (typeof document === "undefined") return

  let video = videoRef.current
  if (!video) {
    video = document.createElement("video")
    video.setAttribute("playsinline", "")
    video.setAttribute("webkit-playsinline", "")
    video.setAttribute("muted", "")
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute("aria-hidden", "true")
    Object.assign(video.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      left: "-9999px",
      top: "-9999px",
      opacity: "0",
      pointerEvents: "none",
    })
    video.src = "/silent-wake.mp4"
    document.body.appendChild(video)
    videoRef.current = video
  }

  video.play().catch(() => {
    /* autoplay bloqué : réessaie au prochain visibility / gesture */
  })
}
