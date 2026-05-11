'use client'
import { useState } from 'react'

type VideoUrls = Partial<Record<'vertical' | 'horizontal' | 'square', string>>
type VideoStatus = 'idle' | 'rendering' | 'ready' | 'failed' | 'uploading' | 'published'

type Props = {
  interventionId: string
  hasPhotos: boolean
  initialVideoUrls?: VideoUrls | null
  initialVideoStatus?: VideoStatus | null
  initialVideoError?: string | null
  initialYoutubeUrl?: string | null
}

const FORMAT_LABEL: Record<keyof VideoUrls, { label: string; ratio: string; usage: string }> = {
  vertical: { label: 'Vertical 9:16', ratio: 'aspect-[9/16]', usage: 'TikTok · Reels · Shorts' },
  horizontal: { label: 'Horizontal 16:9', ratio: 'aspect-video', usage: 'YouTube' },
  square: { label: 'Carré 1:1', ratio: 'aspect-square', usage: 'Feed Instagram' },
}

export default function GenerateVideoButton({
  interventionId,
  hasPhotos,
  initialVideoUrls,
  initialVideoStatus,
  initialVideoError,
  initialYoutubeUrl,
}: Props) {
  const [status, setStatus] = useState<VideoStatus>(initialVideoStatus || 'idle')
  const [videoUrls, setVideoUrls] = useState<VideoUrls>(initialVideoUrls || {})
  const [error, setError] = useState<string | null>(initialVideoError || null)
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(initialYoutubeUrl || null)
  const [ytError, setYtError] = useState<string | null>(null)
  const [ytPosting, setYtPosting] = useState(false)

  const isRendering = status === 'rendering'
  const isUploading = status === 'uploading' || ytPosting
  const hasVideos = Object.keys(videoUrls).length > 0
  const cta = hasVideos ? 'Régénérer la vidéo' : 'Générer la vidéo'
  const needsOAuthConnect = ytError?.includes('Aucun token YouTube') || ytError?.includes('OAuth Google non configuré')

  const generate = async () => {
    setStatus('rendering')
    setError(null)
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setVideoUrls(data.video_urls || {})
      setStatus('ready')
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue')
      setStatus('failed')
    }
  }

  const publishYoutube = async () => {
    setYtPosting(true)
    setYtError(null)
    try {
      const res = await fetch('/api/publish-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setYoutubeUrl(data.url)
      setStatus('published')
    } catch (e: any) {
      setYtError(e?.message || 'Erreur upload YouTube')
    } finally {
      setYtPosting(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Vidéo réseaux sociaux</h2>
          <p className="text-sm text-slate-500">3 formats prêts à publier sur TikTok, YouTube et Instagram</p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isRendering || !hasPhotos}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-700 transition"
        >
          {isRendering ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Génération… (~3 min)
            </>
          ) : (
            <>🎬 {cta}</>
          )}
        </button>
      </div>

      {!hasPhotos ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Aucune photo sur cette intervention. Ajoutez des photos avant de générer la vidéo.
        </div>
      ) : null}

      {isRendering ? (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Le rendu est en cours côté serveur. Ne ferme pas l&apos;onglet — ça prend environ 3 minutes
          pour les 3 formats.
        </div>
      ) : null}

      {status === 'failed' && error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>Échec :</strong> {error}
        </div>
      ) : null}

      {hasVideos ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.keys(FORMAT_LABEL) as Array<keyof VideoUrls>).map((fmt) => {
              const url = videoUrls[fmt]
              if (!url) return null
              const meta = FORMAT_LABEL[fmt]
              return (
                <div key={fmt} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                  <div className={`bg-black ${meta.ratio}`}>
                    <video src={url} controls preload="metadata" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="font-bold text-sm text-slate-800">{meta.label}</div>
                    <div className="text-xs text-slate-500">{meta.usage}</div>
                    <a
                      href={url}
                      download={`ltdb-${fmt}.mp4`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mt-1"
                    >
                      ⬇ Télécharger
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
            <div className="text-sm">
              <div className="font-bold text-slate-800">Publication YouTube</div>
              {youtubeUrl ? (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                >
                  ✅ Publiée — {youtubeUrl}
                </a>
              ) : (
                <div className="text-xs text-slate-500">
                  Le format 16:9 sera uploadé en public avec titre + description SEO automatiques.
                </div>
              )}
            </div>
            {!youtubeUrl ? (
              <button
                type="button"
                onClick={publishYoutube}
                disabled={isUploading || !videoUrls.horizontal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-red-700 transition"
              >
                {ytPosting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Upload…
                  </>
                ) : (
                  <>▶ Publier sur YouTube</>
                )}
              </button>
            ) : null}
          </div>

          {ytError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 space-y-2">
              <div>
                <strong>Échec upload YouTube :</strong> {ytError}
              </div>
              {needsOAuthConnect ? (
                <a
                  href="/api/oauth/google"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 underline hover:text-red-900"
                >
                  → Connecter le compte YouTube (OAuth)
                </a>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
