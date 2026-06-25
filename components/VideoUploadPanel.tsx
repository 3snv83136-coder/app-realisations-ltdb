'use client'

import { useState } from "react"
import { compressVideoInBrowser } from "@/lib/video-compress"

type Props = {
  interventionId: string
  initialVideos?: string[] | null
  /** Compact = version allégée pour le mode terrain. */
  compact?: boolean
  onChange?: (videos: string[]) => void
}

type Phase = 'idle' | 'compressing' | 'uploading' | 'saving'

function fmtMo(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function VideoUploadPanel({ interventionId, initialVideos, compact, onChange }: Props) {
  const [videos, setVideos] = useState<string[]>(initialVideos || [])
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const busy = phase !== 'idle'

  async function handleFile(file: File) {
    setError('')
    setInfo('')
    setProgress(0)

    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|avi|mkv|wmv|webm|flv|3gp|ogv)$/i.test(file.name)) {
      setError('Choisis un fichier vidéo.')
      return
    }

    try {
      // 1) Compression navigateur (tous formats lisibles par le téléphone).
      setPhase('compressing')
      const result = await compressVideoInBrowser(file, {
        maxDimension: 1280,
        videoBitsPerSecond: 2_500_000,
        onProgress: (r) => setProgress(Math.round(r * 100)),
      })

      const gain = result.compressed && result.originalSize > 0
        ? Math.max(0, Math.round((1 - result.outputSize / result.originalSize) * 100))
        : 0
      setInfo(
        result.compressed
          ? `Compressée : ${fmtMo(result.originalSize)} → ${fmtMo(result.outputSize)}${gain > 0 ? ` (−${gain} %)` : ''}`
          : `Format conservé tel quel : ${fmtMo(result.outputSize)}`,
      )

      // 2) URL d'upload signée.
      setPhase('uploading')
      setProgress(0)
      const signRes = await fetch(`/api/interventions/${interventionId}/video-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ext: result.ext }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || `HTTP ${signRes.status}`)

      // 3) Upload direct vers Supabase Storage (PUT sur l'URL signée).
      await uploadWithProgress(signData.signedUrl, result.blob, result.mime, (r) => setProgress(Math.round(r * 100)))

      // 4) Persistance de l'URL publique.
      setPhase('saving')
      const confirmRes = await fetch(`/api/interventions/${interventionId}/video-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: signData.path }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmData.error || `HTTP ${confirmRes.status}`)

      const next: string[] = confirmData.video_uploads || [...videos, confirmData.url]
      setVideos(next)
      onChange?.(next)
      setInfo('✓ Vidéo ajoutée.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPhase('idle')
      setProgress(0)
    }
  }

  async function handleDelete(url: string) {
    if (!confirm('Supprimer cette vidéo ?')) return
    try {
      const res = await fetch(`/api/interventions/${interventionId}/video-upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const next: string[] = data.video_uploads || videos.filter(v => v !== url)
      setVideos(next)
      onChange?.(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const phaseLabel =
    phase === 'compressing' ? `Compression… ${progress}%`
    : phase === 'uploading' ? `Envoi… ${progress}%`
    : phase === 'saving' ? 'Enregistrement…'
    : ''

  return (
    <section className={compact ? 'space-y-3' : 'bg-white rounded-2xl border border-slate-200 p-5 space-y-4'}>
      {!compact && (
        <div>
          <h2 className="text-lg font-bold text-slate-800">Vidéo de l&apos;intervention</h2>
          <p className="text-sm text-slate-500">Tous formats acceptés — compressés automatiquement avant envoi.</p>
        </div>
      )}

      <label
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-4 py-6 cursor-pointer transition ${
          busy ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-300 hover:border-[#0e2a52] hover:bg-slate-50'
        }`}
      >
        <span className="text-3xl">🎥</span>
        <span className="text-sm font-semibold text-slate-700">
          {busy ? phaseLabel : 'Ajouter une vidéo'}
        </span>
        {!busy && (
          <span className="text-xs text-slate-400">MP4, MOV, AVI, MKV… — compression auto</span>
        )}
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            ;(e.target as HTMLInputElement).value = ''
          }}
          className="hidden"
        />
      </label>

      {busy && (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#0e2a52] h-full transition-all"
            style={{ width: `${phase === 'saving' ? 100 : progress}%` }}
          />
        </div>
      )}

      {info && <p className="text-xs text-slate-500">{info}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {videos.length > 0 && (
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {videos.map((url) => (
            <div key={url} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <video src={url} controls preload="metadata" className="w-full max-h-56 bg-black object-contain" />
              <div className="flex items-center justify-between gap-2 p-2">
                <a
                  href={url}
                  download
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  ⬇ Télécharger
                </a>
                <button
                  type="button"
                  onClick={() => void handleDelete(url)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function uploadWithProgress(
  signedUrl: string,
  blob: Blob,
  contentType: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl, true)
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload échoué (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload réseau échoué'))
    xhr.send(blob)
  })
}
