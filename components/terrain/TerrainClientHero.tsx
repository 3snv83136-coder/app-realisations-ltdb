'use client'

import dynamic from 'next/dynamic'
import {
  buildChantierAddress,
  googleMapsDirectionsUrl,
  mappyItineraireUrl,
  wazeNavigateUrl,
} from '@/lib/navigation-apps'

const InterventionMap = dynamic(() => import('@/components/InterventionMap'), { ssr: false })

type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | string

const HERO_BY_STATUT: Record<string, { card: string; muted: string }> = {
  planifiee: { card: 'bg-amber-100 border-amber-400 text-amber-950', muted: 'text-amber-900/80' },
  en_cours: { card: 'bg-blue-100 border-blue-400 text-blue-950', muted: 'text-blue-900/80' },
  terminee: { card: 'bg-emerald-100 border-emerald-400 text-emerald-950', muted: 'text-emerald-900/80' },
  annulee: { card: 'bg-slate-100 border-slate-300 text-slate-800', muted: 'text-slate-600' },
}

function heroStyle(statut: Statut) {
  return HERO_BY_STATUT[statut] || HERO_BY_STATUT.planifiee
}

export default function TerrainClientHero({
  statut,
  clientNom,
  clientTelephone,
  adresseChantier,
  clientAdresse,
  ville,
  codePostal,
  typeIntervention,
}: {
  statut: Statut
  clientNom?: string | null
  clientTelephone?: string | null
  adresseChantier?: string | null
  clientAdresse?: string | null
  ville?: string | null
  codePostal?: string | null
  typeIntervention?: string | null
}) {
  const style = heroStyle(statut)
  const villeLabel = [codePostal, ville].filter(Boolean).join(' ') || ville || '—'
  const adresseLine = (adresseChantier || clientAdresse || '').trim()
  const gpsQuery = buildChantierAddress({
    adresseChantier,
    adresse: clientAdresse,
    codePostal,
    ville,
  })

  return (
    <section className={`rounded-2xl border-2 shadow-sm overflow-hidden ${style.card}`}>
      <div className="p-4 sm:p-5 space-y-3">
        <div>
          <div className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">
            {villeLabel}
          </div>
          <div className="text-lg sm:text-xl font-bold mt-1 truncate">
            {clientNom || 'Client —'}
          </div>
          {clientTelephone ? (
            <a
              href={`tel:${clientTelephone.replace(/\s/g, '')}`}
              className="inline-block mt-2 text-xl sm:text-2xl font-black underline-offset-2 hover:underline"
            >
              📞 {clientTelephone}
            </a>
          ) : (
            <p className={`mt-2 text-sm font-semibold ${style.muted}`}>Téléphone non renseigné</p>
          )}
          {adresseLine && (
            <p className={`mt-2 text-sm font-medium ${style.muted}`}>📍 {adresseLine}</p>
          )}
          {typeIntervention && (
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${style.muted}`}>
              {typeIntervention}
            </p>
          )}
        </div>

        {gpsQuery && (
          <>
            <InterventionMap
              adresse={adresseChantier || clientAdresse || undefined}
              ville={ville || undefined}
              codePostal={codePostal || undefined}
              className="h-44 sm:h-52 rounded-xl overflow-hidden border-2 border-black/10 shadow-inner"
              zoom={15}
            />
            <div className="grid grid-cols-3 gap-2">
              <a
                href={googleMapsDirectionsUrl(gpsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl bg-white/90 hover:bg-white border border-black/10 font-bold text-xs sm:text-sm text-[#0e2a52] shadow-sm transition active:scale-[0.98]"
              >
                <span className="text-lg">🗺</span>
                <span>Maps</span>
              </a>
              <a
                href={wazeNavigateUrl(gpsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl bg-white/90 hover:bg-white border border-black/10 font-bold text-xs sm:text-sm text-[#0e2a52] shadow-sm transition active:scale-[0.98]"
              >
                <span className="text-lg">🚗</span>
                <span>Waze</span>
              </a>
              <a
                href={mappyItineraireUrl(gpsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl bg-white/90 hover:bg-white border border-black/10 font-bold text-xs sm:text-sm text-[#0e2a52] shadow-sm transition active:scale-[0.98]"
              >
                <span className="text-lg">📍</span>
                <span>Mappy</span>
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
