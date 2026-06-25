'use client'

/**
 * Compression vidéo 100 % navigateur — aucune dépendance externe.
 *
 * Principe : on lit la vidéo source (n'importe quel format que le téléphone sait
 * décoder : .mov/.mp4 iPhone, .mp4 Android, .webm…), on la rejoue dans un
 * <video> masqué, on redessine chaque image dans un <canvas> redimensionné, et
 * on ré-encode le flux (canvas vidéo + audio d'origine) via MediaRecorder dans
 * le format le plus léger supporté (MP4 sur Safari, WebM/VP9 ailleurs).
 *
 * Si le navigateur ne supporte pas la chaîne MediaRecorder/captureStream, on
 * renvoie le fichier d'origine tel quel (compressed = false) — l'upload se fait
 * quand même, sans blocage.
 */

export type CompressOptions = {
  /** Plus grand côté de la vidéo de sortie (px). Réduit uniquement, jamais agrandi. */
  maxDimension?: number
  /** Images par seconde de la sortie. */
  fps?: number
  /** Débit vidéo cible (bits/s). 2.5 Mbit/s ≈ bon compromis 720p. */
  videoBitsPerSecond?: number
  /** Débit audio cible (bits/s). */
  audioBitsPerSecond?: number
  /** Progression 0→1. */
  onProgress?: (ratio: number) => void
}

export type CompressResult = {
  blob: Blob
  ext: string
  mime: string
  compressed: boolean
  originalSize: number
  outputSize: number
}

function pickRecorderMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates: { mime: string; ext: string }[] = [
    { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c
    } catch {
      /* ignore */
    }
  }
  return null
}

function extFromFile(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i)
  return (m?.[1] || 'mp4').toLowerCase()
}

type CaptureableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream
  mozCaptureStream?: () => MediaStream
}

function getElementStream(video: CaptureableVideo): MediaStream | null {
  try {
    if (typeof video.captureStream === 'function') return video.captureStream()
    if (typeof video.mozCaptureStream === 'function') return video.mozCaptureStream()
  } catch {
    /* ignore */
  }
  return null
}

function supportsPipeline(): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  const hasCanvasCapture = typeof canvas.captureStream === 'function'
  const hasRecorder = typeof MediaRecorder !== 'undefined'
  return hasCanvasCapture && hasRecorder
}

export async function compressVideoInBrowser(
  file: File,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const {
    maxDimension = 1280,
    fps = 30,
    videoBitsPerSecond = 2_500_000,
    audioBitsPerSecond = 128_000,
    onProgress,
  } = opts

  const fallback = (): CompressResult => ({
    blob: file,
    ext: extFromFile(file),
    mime: file.type || 'video/mp4',
    compressed: false,
    originalSize: file.size,
    outputSize: file.size,
  })

  const recorderMime = pickRecorderMime()
  if (!recorderMime || !supportsPipeline()) return fallback()

  const url = URL.createObjectURL(file)
  const video = document.createElement('video') as CaptureableVideo
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  ;(video as HTMLVideoElement).setAttribute('playsinline', 'true')

  try {
    await new Promise<void>((resolve, reject) => {
      const onMeta = () => resolve()
      const onErr = () => reject(new Error('Lecture vidéo impossible'))
      video.addEventListener('loadedmetadata', onMeta, { once: true })
      video.addEventListener('error', onErr, { once: true })
    })

    const srcW = video.videoWidth
    const srcH = video.videoHeight
    const duration = video.duration
    if (!srcW || !srcH || !Number.isFinite(duration) || duration <= 0) {
      return fallback()
    }

    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
    // Dimensions paires (exigé par certains encodeurs).
    const outW = Math.max(2, Math.round((srcW * scale) / 2) * 2)
    const outH = Math.max(2, Math.round((srcH * scale) / 2) * 2)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback()

    const canvasStream = canvas.captureStream(fps)
    const elementStream = getElementStream(video)
    const audioTracks = elementStream?.getAudioTracks() ?? []
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks(), ...audioTracks]
    const mixedStream = new MediaStream(tracks)

    const recorder = new MediaRecorder(mixedStream, {
      mimeType: recorderMime.mime,
      videoBitsPerSecond,
      audioBitsPerSecond,
    })

    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data)
    }

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorderMime.mime }))
      recorder.onerror = () => reject(new Error('Encodage interrompu'))
    })

    let stopped = false
    const stopAll = () => {
      if (stopped) return
      stopped = true
      try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* ignore */ }
      canvasStream.getTracks().forEach(t => t.stop())
      audioTracks.forEach(t => t.stop())
    }

    let rafId = 0
    const draw = () => {
      if (stopped) return
      ctx.drawImage(video, 0, 0, outW, outH)
      if (onProgress && duration > 0) {
        onProgress(Math.min(0.99, video.currentTime / duration))
      }
      rafId = requestAnimationFrame(draw)
    }

    recorder.start(1000)
    await video.play()
    draw()

    video.addEventListener('ended', stopAll, { once: true })

    // Sécurité : on borne à 1,5× la durée réelle au cas où 'ended' ne se déclenche pas.
    const safetyMs = Math.ceil(duration * 1000 * 1.5) + 5000
    const safety = setTimeout(stopAll, safetyMs)

    const blob = await done
    clearTimeout(safety)
    cancelAnimationFrame(rafId)
    onProgress?.(1)

    // Si la « compression » a paradoxalement grossi le fichier, on garde l'original.
    if (blob.size >= file.size) return fallback()

    return {
      blob,
      ext: recorderMime.ext,
      mime: recorderMime.mime,
      compressed: true,
      originalSize: file.size,
      outputSize: blob.size,
    }
  } catch {
    return fallback()
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    try { video.load() } catch { /* ignore */ }
  }
}
