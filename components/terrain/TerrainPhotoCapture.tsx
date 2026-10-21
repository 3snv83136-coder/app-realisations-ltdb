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

function formatCatchError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e.trim()) return e
  // FileReader / XHR : onerror reçoit un ProgressEvent → String(e) = "[object ProgressEvent]"
  if (e && typeof e === 'object') {
    const any = e as { type?: string; target?: { error?: { message?: string } | null } }
    const fr = any.target?.error?.message
    if (fr) return fr
    if (any.type === 'error') return 'Lecture du fichier impossible (format photo non supporté ou fichier corrompu).'
  }
  return 'Erreur inattendue lors de l’envoi de la photo.'
}

/**
 * Composant de capture photo unique avec 3 sources : caméra, galerie, fichier.
 * Compresse côté client puis upload vers /api/interventions/[id]/photo.
 * Sur iPhone : object URL (pas FileReader) + fallback sans compression si HEIC échoue.
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

  async function compress(file: File): Promise<File> {
    if (file.type === 'application/pdf') return file
    if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
      return file
    }

    let objectUrl: string | null = null
    let bitmap: ImageBitmap | null = null
    try {
      let source: CanvasImageSource
      let width: number
      let height: number

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

      if (!bitmap) {
        // Object URL > FileReader : évite [object ProgressEvent] sur iPhone / HEIC
        objectUrl = URL.createObjectURL(file)
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = () => reject(new Error('Lecture image impossible — essaye Galerie ou une photo JPEG.'))
          el.src = objectUrl!
        })
        source = img
        width = img.naturalWidth || img.width
        height = img.naturalHeight || img.height
      }

      const maxDim = 1920
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas non supporté')
      ctx.drawImage(source!, 0, 0, width, height)

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.82)
      })
      if (!blob) throw new Error('Compression échouée')
      const base = file.name.replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, '') || 'photo'
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
    } catch {
      // HEIC non décodable en canvas → envoi de l’original (Supabase accepte)
      return file
    } finally {
      if (bitmap) bitmap.close()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setError('')
    setUploading(true)
    let localPreview: string | null = null
    try {
      const compressed = await compress(file)
      localPreview = URL.createObjectURL(compressed)
      setPreview(localPreview)

      const fd = new FormData()
      fd.append('photo', compressed)
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

      onUploaded(data.url, data.terrain_step ?? 0)
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
      {/* Inputs cachés — un par source */}
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
          <p className="text-sm font-bold text-blue-700">Envoi en cours…</p>
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
