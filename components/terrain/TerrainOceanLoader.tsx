'use client'
import { useEffect, useState } from "react"

const OCEAN_STEPS = [
  '🌊 On largue les amarres…',
  '🐟 Les poissons analysent le bouchon…',
  '🦀 Les crabes vérifient les tuyaux…',
  '🐙 La pieuvre structure le rapport…',
  '🐠 Petite halte au récif…',
  '🌴 On longe les côtes du Var…',
  '⛵ On approche du soleil…',
  '🌞 Plus que quelques mètres !',
]

interface Props {
  /** Si true, force la barre à 100% (succès — la mer rejoint le soleil) */
  done?: boolean
}

/**
 * Loader ludique LTDB pour la génération de rapport.
 * Thématique : mer qui monte vers le soleil. Le bateau avance avec la marée.
 * Progression fake asymptotique (0 → 95 % autonome), passe à 100 % quand done=true.
 */
export default function TerrainOceanLoader({ done }: Props) {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (done) {
      setProgress(100)
      return
    }
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 95) return 95
        // Asymptote : on avance vite au début, on ralentit à l'approche du soleil
        const remaining = 95 - p
        const inc = Math.max(0.25, remaining * 0.025)
        return Math.min(95, p + inc)
      })
    }, 180)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    const id = setInterval(() => setStepIdx(i => (i + 1) % OCEAN_STEPS.length), 2400)
    return () => clearInterval(id)
  }, [])

  // Position bateau : suit la mer mais avec un offset pour rester à la surface
  const boatLeft = Math.max(2, Math.min(progress - 4, 86))

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes ltdb-wave1 { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ltdb-wave2 { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ltdb-sun-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.15); }
        }
        @keyframes ltdb-boat-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }
        .ltdb-wave-1 { animation: ltdb-wave1 4s linear infinite; }
        .ltdb-wave-2 { animation: ltdb-wave2 6s linear infinite; }
        .ltdb-sun { animation: ltdb-sun-pulse 3s ease-in-out infinite; }
        .ltdb-boat { animation: ltdb-boat-bob 2s ease-in-out infinite; }
      `}</style>

      {/* Scène mer + soleil */}
      <div
        className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border-2 border-blue-200 shadow-lg"
        style={{
          background: 'linear-gradient(to bottom, #fef3c7 0%, #fde68a 20%, #fdba74 38%, #fca5a5 48%, #93c5fd 55%, #60a5fa 65%, #1e40af 100%)',
        }}
      >
        {/* Soleil — coin haut-droit, pulse subtil */}
        <div
          className="ltdb-sun absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full"
          style={{
            top: '8px',
            right: '12px',
            background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #facc15 35%, #f59e0b 75%, #ea580c 100%)',
            boxShadow: '0 0 40px 12px rgba(251, 191, 36, 0.65), 0 0 80px 24px rgba(249, 115, 22, 0.35)',
          }}
        />

        {/* Reflet du soleil sur la mer (s'efface quand le bateau approche) */}
        <div
          className="absolute right-[3%] bottom-[6%] w-8 h-2 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(ellipse, rgba(250,204,21,0.8), transparent)',
            opacity: Math.max(0, 0.6 - progress / 200),
          }}
        />

        {/* Mer (largeur = progression) */}
        <div
          className="absolute bottom-0 left-0 transition-all duration-300 ease-out overflow-hidden"
          style={{
            width: `${progress}%`,
            height: '52%',
            background: 'linear-gradient(to bottom, #2563eb 0%, #1e40af 60%, #1e3a8a 100%)',
          }}
        >
          {/* Vague avant (rapide, écume) */}
          <svg
            className="ltdb-wave-1 absolute top-0 left-0 h-6"
            style={{ width: '200%' }}
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q150,2 300,20 T600,20 T900,20 T1200,20 L1200,40 L0,40 Z"
              fill="white"
              fillOpacity="0.35"
            />
          </svg>
          {/* Vague arrière (lente, sombre) */}
          <svg
            className="ltdb-wave-2 absolute top-2 left-0 h-5"
            style={{ width: '200%' }}
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q200,6 400,20 T800,20 T1200,20 L1200,40 L0,40 Z"
              fill="#60a5fa"
              fillOpacity="0.4"
            />
          </svg>
        </div>

        {/* Bateau — suit la mer, balancement */}
        <div
          className="absolute text-3xl sm:text-4xl pointer-events-none transition-all duration-300 ease-out"
          style={{
            left: `${boatLeft}%`,
            bottom: '46%',
          }}
        >
          <span className="ltdb-boat inline-block">⛵</span>
        </div>

        {/* Quand done=true → emoji célébration */}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-sm">
            <div className="text-5xl animate-bounce">🎉</div>
          </div>
        )}
      </div>

      {/* Étape en cours + pourcentage */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center gap-3">
          <span className="text-sm font-bold text-blue-800 truncate">{OCEAN_STEPS[stepIdx]}</span>
          <span className="text-sm font-black text-slate-700 tabular-nums flex-shrink-0">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
