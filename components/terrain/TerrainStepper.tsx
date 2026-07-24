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

interface TerrainStepperProps {
  current: number
  onStepClick?: (step: number) => void
  /** Masquer certaines étapes (ex. « Réseaux » pour les techniciens). */
  hiddenSteps?: number[]
}

export default function TerrainStepper({ current, onStepClick, hiddenSteps = [] }: TerrainStepperProps) {
  const steps = TERRAIN_STEPS.filter(s => !hiddenSteps.includes(s.key))
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [current, steps.length])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm sticky top-14 z-20 overflow-hidden">
      <div
        className="flex items-center gap-0.5 overflow-x-auto px-2 py-2.5 scrollbar-hide snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {steps.map((s, i) => {
          const done = current > s.key
          const active = current === s.key
          const clickable = done && onStepClick
          return (
            <div key={s.key} className="flex items-center flex-shrink-0 snap-center">
              <button
                ref={active ? activeRef : undefined}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(s.key)}
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
