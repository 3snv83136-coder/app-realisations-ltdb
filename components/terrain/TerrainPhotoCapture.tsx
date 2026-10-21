'use client'
import { useRef, useState } from "react"
import { isPhotoCategory, type PhotoCategory } from "@/lib/photo-categories"

interface TerrainPhotoCaptureProps {
  interventionId: string
  legendeDefaut: string
  /** Catégorie sémantique pour publication site (avant, apres, camera…) */
  categorie?: PhotoCategory
  /** Appelé après upload réussi (URL publique de la photo) */
  onUploaded: (url: string, terrain_step: number) => void
  /** Texte du gros bouton principal */
  titre?: string
}

/** Limite sous le plafond Vercel (~4,5 Mo) pour éviter « Failed to fetch ». */
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

function formatCatchError(e: unknown): string {
  if (e instanceof TypeError || (e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message))) {
    return 'Envoi impossible (réseau ou photo trop lourde). Vérifie la connexion 4G/Wi‑Fi, ou réessaie via Galerie.'
  }
  if (e instanceof Error && e.message) {
    if (/failed to fetch/i.test(e.message)) {
      return 'Envoi impossible (réseau ou photo trop lourde). Vérifie la connexion, ou réessaie via Galerie.'
    }
    return e.message
  }
  if (typeof e === 'string' && e.trim()) {
    if (/failed to fetch/i.test(e)) {
      return 'Envoi impossible (réseau ou photo trop lourde). Vérifie la connexion, ou réessaie via Galerie.'
    }
    return e
  }
  // FileReader / XHR : onerror reçoit un ProgressEvent → String(e) = "[object ProgressEvent]"
  if (e && typeof e === 'object') {
    const any = e as { type?: string; target?: { error?: { message?: string } | null } }
    const fr = any.target?.error?.message
    if (fr) return fr
    if (any.type === 'error') return 'Lecture du fichier impossible (format photo non supporté ou fichier corrompu).'
  }
  return 'Erreur inattendue lors de l’envoi de la photo.'
}

function isHeicLike(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  const n = file.name.toLowerCase()
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif')
}

/**
 * Compresse en JPEG sous MAX_UPLOAD_BYTES.
 * Sur iPhone : object URL (pas FileReader) pour éviter ProgressEvent.
 * Ne renvoie jamais un HEIC / original trop lourd (sinon Vercel coupe → Failed to fetch).
 */
async function compressForUpload(file: File): Promise<File> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('PDF trop lourd (max ~3,5 Mo).')
    }
    return file
  }
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
    throw new Error('Format de fichier non supporté.')
  }

  let objectUrl: string | null = null
  let bitmap: ImageBitmap | null = null
  try {
    let source: CanvasImageSource | null = null
    let width = 0
    let height = 0

    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file)
        source = bitmap
        width = bitmap.width
        height = bitmap.height
      } catch {
        bitmap = null
      }
    }

    if (!source) {
      objectUrl = URL.createObjectURL(file)
      const url = objectUrl
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error(
          isHeicLike(file)
            ? 'Photo HEIC non lisible. Dans Réglages iPhone → Appareil photo, active « Formats compatibles », ou choisis une photo via Galerie.'
            : 'Lecture image impossible — réessaie via Galerie.',
        ))
        el.src = url
      })
      source = img
      width = img.naturalWidth || img.width
      height = img.naturalHeight || img.height
    }

    if (!source || width <= 0 || height <= 0) {
      throw new Error('Dimensions image invalides')
    }

    const base = file.name.replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, '') || 'photo'
    const attempts: { maxDim: number; quality: number }[] = [
      { maxDim: 1600, quality: 0.78 },
      { maxDim: 1280, quality: 0.7 },
      { maxDim: 1024, quality: 0.62 },
      { maxDim: 800, quality: 0.55 },
    ]

    for (const { maxDim, quality } of attempts) {
      let w = width
      let h = height
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas non supporté')
      ctx.drawImage(source, 0, 0, w, h)

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality)
      })
      if (!blob) continue
      if (blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
      }
    }

    throw new Error('Photo trop lourde même après compression. Réessaie une photo moins détaillée via Galerie.')
  } catch (e) {
    // Ne pas renvoyer l’original HEIC/lourd : Vercel coupe → « Failed to fetch »
    if (e instanceof Error) throw e
    if (file.size > MAX_UPLOAD_BYTES || isHeicLike(file)) {
      throw new Error(
        'Impossible de compresser cette photo. Active « Formats compatibles » sur l’iPhone, ou envoie via Galerie en JPEG.',
      )
    }
    if (file.size <= MAX_UPLOAD_BYTES) return file
    throw new Error('Photo trop lourde (max ~3,5 Mo).')
  } finally {
    if (bitmap) bitmap.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

async function postPhoto(
  interventionId: string,
  file: File,
  legendeDefaut: string,
  categorie?: PhotoCategory,
): Promise<{ url: string; terrain_step: number }> {
  const fd = new FormData()
  fd.append('photo', file)
  fd.append('legende', legendeDefaut)
  if (categorie && isPhotoCategory(categorie)) {
    fd.append('categorie', categorie)
  }

  const res = await fetch(`/api/interventions/${interventionId}/photo`, {
    method: 'POST',
    body: fd,
  })

  let data: { error?: string; url?: string; terrain_step?: number } = {}
  try {
    data = await res.json()
  } catch {
    throw new Error(res.ok ? 'Réponse serveur invalide' : `Erreur serveur HTTP ${res.status}`)
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  if (!data.url) throw new Error('URL photo manquante dans la réponse')
  return { url: data.url, terrain_step: data.terrain_step ?? 0 }
}

/**
 * Composant de capture photo unique avec 3 sources : caméra, galerie, fichier.
 * Compresse côté client puis upload vers /api/interventions/[id]/photo.
 */
export default function TerrainPhotoCapture({
  interventionId,
  legendeDefaut,
  categorie,
  onUploaded,
  titre = 'Prendre une photo',
}: TerrainPhotoCaptureProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setError('')
    setUploading(true)
    let localPreview: string | null = null
    try {
      const compressed = await compressForUpload(file)
      localPreview = URL.createObjectURL(compressed)
      setPreview(localPreview)

      let result: { url: string; terrain_step: number }
      try {
        result = await postPhoto(interventionId, compressed, legendeDefaut, categorie)
      } catch (first) {
        // Un seul retry sur coupure réseau mobile
        if (first instanceof TypeError || (first instanceof Error && /failed to fetch/i.test(first.message))) {
          await new Promise(r => setTimeout(r, 600))
          result = await postPhoto(interventionId, compressed, legendeDefaut, categorie)
        } else {
          throw first
        }
      }

      onUploaded(result.url, result.terrain_step)
    } catch (e) {
      setError(formatCatchError(e))
      if (localPreview) URL.revokeObjectURL(localPreview)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { void handleFile(e.target.files?.[0] || null); e.target.value = '' }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { void handleFile(e.target.files?.[0] || null); e.target.value = '' }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => { void handleFile(e.target.files?.[0] || null); e.target.value = '' }}
      />

      {preview && (
        <div className="rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Aperçu" className="w-full h-auto max-h-80 object-contain" />
        </div>
      )}

      {!uploading && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-5 px-6 font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition disabled:opacity-50"
          >
            <span className="text-3xl">📷</span>
            {titre}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl py-4 font-bold text-sm flex flex-col items-center gap-1 transition disabled:opacity-50"
            >
              <span className="text-2xl">🖼</span>
              Galerie
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl py-4 font-bold text-sm flex flex-col items-center gap-1 transition disabled:opacity-50"
            >
              <span className="text-2xl">📁</span>
              Fichier
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 text-center">
          <div className="animate-spin h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm font-bold text-blue-700">Compression & envoi…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 p-3 rounded-xl text-sm font-semibold">
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
