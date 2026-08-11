'use client'

import { useEffect, useRef } from 'react'

export const TERRAIN_STEPS = [
  { key: 0, label: 'Photo avant', icon: '📷' },
  { key: 1, label: 'Démarrer', icon: '▶' },
  { key: 2, label: 'Photo après', icon: '📷' },
  { key: 3, label: 'Rapport', icon: '🎤' },
  { key: 4, label: 'Garanti', icon: '🛡️' },
  { key: 5, label: 'Facture', icon: '🧾' },
  { key: 6, label: 'Signature', icon: '✍️' },
  { key: 7, label: 'Devis', icon: '📋' },
  { key: 8, label: 'Diffusion', icon: '✉' },
  { key: 9, label: 'Réseaux', icon: '📍' },
] as const

export type TerrainStep = typeof TERRAIN_STEPS[number]['key']

type DisplayStep =
  | { kind: 'db'; key: number; label: string; icon: string }
  | { kind: 'attestation'; key: 'attestation'; label: string; icon: string }

interface TerrainStepperProps {
  current: number
  onStepClick?: (step: number) => void
  /** Masquer certaines étapes (ex. « Réseaux » pour les techniciens). */
  hiddenSteps?: number[]
  /** Affiche l'onglet Attestation entre Facture et Signature. */
  showAttestationStep?: boolean
  /** Attestation déjà générée ou passée. */
  attestationResolved?: boolean
  /** true = on affiche actuellement l'UI attestation (pas encore Signature). */
  attestationActive?: boolean
  /** Revenir à l'écran attestation (si déjà traitée). */
  onAttestationClick?: () => void
}

export default function TerrainStepper({
  current,
  onStepClick,
  hiddenSteps = [],
  showAttestationStep = false,
  attestationResolved = false,
  attestationActive = false,
  onAttestationClick,
}: TerrainStepperProps) {
  const steps: DisplayStep[] = []
  for (const s of TERRAIN_STEPS) {
    if (hiddenSteps.includes(s.key)) continue
    if (showAttestationStep && s.key === 6) {
      steps.push({ kind: 'attestation', key: 'attestation', label: 'Attestation', icon: '📜' })
    }
    steps.push({ kind: 'db', key: s.key, label: s.label, icon: s.icon })
  }

  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [current, attestationActive, steps.length])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm sticky top-14 z-20 overflow-hidden">
      <div
        className="flex items-center gap-0.5 overflow-x-auto px-2 py-2.5 scrollbar-hide snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {steps.map((s, i) => {
          let done = false
          let active = false
          if (s.kind === 'attestation') {
            done = attestationResolved && !attestationActive
            active = attestationActive
            // Si on est déjà passé à Signature+ sans forcer l'UI attestation
            if (!attestationActive && (current > 6 || (current === 6 && attestationResolved))) {
              done = true
            }
          } else if (s.key < 6) {
            done = current > s.key
            active = current === s.key
          } else if (s.key === 6) {
            // Signature : active seulement si step 6 et attestation résolue (ou pas d'étape att.)
            done = current > 6
            active = current === 6 && !attestationActive && (!showAttestationStep || attestationResolved)
          } else {
            done = current > s.key
            active = current === s.key
          }

          const clickable =
            (s.kind === 'attestation' && done && !!onAttestationClick)
            || (s.kind === 'db' && done && !!onStepClick)

          return (
            <div key={s.key} className="flex items-center flex-shrink-0 snap-center">
              <button
                ref={active ? activeRef : undefined}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (s.kind === 'attestation') onAttestationClick?.()
                  else if (clickable) onStepClick?.(s.key)
                }}
                className={`flex flex-col items-center gap-0.5 px-1.5 sm:px-2 py-1 rounded-lg transition min-w-[52px] sm:min-w-[64px] ${
                  active ? 'bg-blue-50' : ''
                } ${clickable ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'}`}
                title={s.label}
                aria-current={active ? 'step' : undefined}
              >
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base font-bold transition ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                      ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-200'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : s.icon}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] font-bold whitespace-nowrap max-w-[4.5rem] truncate ${
                    active ? 'text-blue-700' : done ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={`w-2 sm:w-3 h-0.5 mx-0.5 flex-shrink-0 ${
                    done ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
