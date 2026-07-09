'use client'
import { useState } from 'react'
import TerrainPhotoCapture from '@/components/terrain/TerrainPhotoCapture'
import {
  PHOTO_CATEGORY_ICONS,
  PHOTO_CATEGORY_LABELS,
  type PhotoCategory,
} from '@/lib/photo-categories'
import { proxyImageUrl } from '@/lib/proxyImageUrl'

const EXTRA_CATEGORIES: PhotoCategory[] = ['pendant', 'camera', 'dechets']

type Props = {
  interventionId: string
  photosUrls: string[]
  photosLegendes: string[]
  photosCategories?: string[]
  onUploaded: () => void
}

/**
 * Photos complémentaires terrain (pendant, caméra, déchets) pour enrichir
 * la page publiée avec des preuves visuelles catégorisées.
 */
export default function TerrainExtraPhotos({
  interventionId,
  photosUrls,
  photosLegendes,
  photosCategories = [],
  onUploaded,
}: Props) {
  const [openCat, setOpenCat] = useState<PhotoCategory | null>(null)

  const countByCat = (cat: PhotoCategory) =>
    photosUrls.filter((_, i) => {
      const raw = photosCategories[i]
      if (raw === cat) return true
      const leg = (photosLegendes[i] || '').toLowerCase()
      if (cat === 'camera' && (leg.includes('caméra') || leg.includes('camera'))) return true
      if (cat === 'dechets' && (leg.includes('déchets') || leg.includes('dechets') || leg.includes('racines'))) return true
      if (cat === 'pendant' && leg.includes('pendant')) return true
      return false
    }).length

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-slate-800">📸 Photos complémentaires</h2>
        <p className="text-xs text-slate-500 mt-1">
          Caméra, déchets extraits, travaux en cours — elles enrichissent la page sur le site.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {EXTRA_CATEGORIES.map(cat => {
          const count = countByCat(cat)
          const isOpen = openCat === cat
          return (
            <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCat(isOpen ? null : cat)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition"
              >
                <span className="font-bold text-sm text-slate-800">
                  {PHOTO_CATEGORY_ICONS[cat]} {PHOTO_CATEGORY_LABELS[cat]}
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  {count > 0 ? `✓ ${count}` : '+ ajouter'}
                </span>
              </button>
              {isOpen && (
                <div className="p-4 border-t border-slate-200 space-y-3">
                  {photosUrls.map((url, i) => {
                    const match =
                      photosCategories[i] === cat ||
                      (cat === 'camera' && (photosLegendes[i] || '').toLowerCase().includes('caméra')) ||
                      (cat === 'dechets' && /déchets|dechets|racines|tartre/i.test(photosLegendes[i] || '')) ||
                      (cat === 'pendant' && (photosLegendes[i] || '').toLowerCase().includes('pendant'))
                    if (!match) return null
                    return (
                      <img
                        key={`${url}-${i}`}
                        src={proxyImageUrl(url)}
                        alt={photosLegendes[i] || PHOTO_CATEGORY_LABELS[cat]}
                        className="w-full max-h-40 object-cover rounded-lg border border-slate-200"
                      />
                    )
                  })}
                  <TerrainPhotoCapture
                    interventionId={interventionId}
                    legendeDefaut={PHOTO_CATEGORY_LABELS[cat]}
                    categorie={cat}
                    titre={`Ajouter — ${PHOTO_CATEGORY_LABELS[cat]}`}
                    onUploaded={() => {
                      setOpenCat(null)
                      onUploaded()
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
