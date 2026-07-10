'use client'
import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Bulles d'eau de l'arrière-plan animé. Valeurs FIXES (jamais Math.random) :
 * la page est rendue côté serveur puis hydratée — des valeurs aléatoires
 * provoqueraient un hydration mismatch React.
 */
const BUBBLES = [
  { left: '8%',  size: 28, delay: '0s',    dur: '15s' },
  { left: '17%', size: 13, delay: '3.5s',  dur: '11s' },
  { left: '26%', size: 42, delay: '6s',    dur: '18s' },
  { left: '35%', size: 18, delay: '1.5s',  dur: '12s' },
  { left: '44%', size: 24, delay: '8.5s',  dur: '16s' },
  { left: '53%', size: 11, delay: '4s',    dur: '10s' },
  { left: '61%', size: 34, delay: '2s',    dur: '17s' },
  { left: '69%', size: 20, delay: '7s',    dur: '13s' },
  { left: '77%', size: 16, delay: '5s',    dur: '11s' },
  { left: '85%', size: 30, delay: '9.5s',  dur: '19s' },
  { left: '92%', size: 14, delay: '2.5s',  dur: '12s' },
  { left: '13%', size: 10, delay: '11s',   dur: '9s'  },
  { left: '49%', size: 9,  delay: '12.5s', dur: '10s' },
  { left: '32%', size: 22, delay: '13s',   dur: '16s' },
]

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const revoked = new URLSearchParams(window.location.search).get('revoked')
    if (revoked === '1') {
      setError('Votre accès démo a été révoqué. Contactez le gérant pour un nouvel accès.')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const username = (form.get('username') as string)?.trim()
    const password = (form.get('password') as string) || ''
    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError('Identifiant ou mot de passe incorrect.')
      setLoading(false)
    } else {
      const res = await fetch('/api/auth/session')
      const sess = await res.json().catch(() => ({}))
      const dest = sess?.user?.role === 'tech' ? '/planning' : '/'
      router.push(dest)
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(140deg,#081a33 0%,#0e2a52 42%,#1d4e8f 100%)' }}
    >
      <style>{`
        @keyframes ltdbBubble {
          0%   { transform: translateY(15vh) scale(.5); opacity: 0; }
          12%  { opacity: .55; }
          85%  { opacity: .32; }
          100% { transform: translateY(-112vh) scale(1.15); opacity: 0; }
        }
        @keyframes ltdbCardIn {
          from { opacity: 0; transform: translateY(30px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ltdbGlow {
          0%,100% { box-shadow: 0 8px 24px rgba(0,0,0,.18), 0 0 0 0 rgba(96,165,250,.0); }
          50%     { box-shadow: 0 8px 24px rgba(0,0,0,.18), 0 0 26px 4px rgba(96,165,250,.45); }
        }
        @keyframes ltdbDrop {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-7px); }
        }
        @keyframes ltdbSheen {
          0%,100% { opacity: .25; transform: translateX(-30%) rotate(8deg); }
          50%     { opacity: .55; transform: translateX(30%) rotate(8deg); }
        }
      `}</style>

      {/* Bulles d'eau qui remontent */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,.95), rgba(255,255,255,.18) 60%, transparent 75%)',
              border: '1px solid rgba(255,255,255,.22)',
              animation: `ltdbBubble ${b.dur} linear ${b.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Halo lumineux */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(96,165,250,.38), transparent 70%)' }}
        aria-hidden="true"
      />
      {/* Reflet animé */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-1/4 left-1/2 h-[150%] w-1/3 -translate-x-1/2"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)',
            animation: 'ltdbSheen 9s ease-in-out infinite',
          }}
        />
      </div>

      {/* Carte de connexion */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white/95 p-8 ring-1 ring-white/50 backdrop-blur-md"
        style={{ animation: 'ltdbCardIn .7s cubic-bezier(.2,.8,.2,1) both', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="text-5xl" style={{ animation: 'ltdbDrop 3s ease-in-out infinite' }}>
            💧
          </div>
          <h1 className="mt-3 text-xl font-black leading-tight text-[#0e2a52]">
            Les Techniciens
            <br />
            du Débouchage
          </h1>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Espace pro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <input
            name="username"
            type="text"
            placeholder="Identifiant"
            autoComplete="username"
            required
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          />
          <input
            name="password"
            type="password"
            placeholder="Mot de passe (démo & techniciens)"
            autoComplete="current-password"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          />
          <p className="text-[11px] text-slate-500 -mt-1">
            Gérant : identifiant seul. Démo &amp; techniciens : identifiant + mot de passe.
          </p>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              ⚠ {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#0e2a52] to-[#2c5fa8] py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ animation: loading ? undefined : 'ltdbGlow 3s ease-in-out infinite' }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          lestechniciensdudebouchage.fr
        </p>
      </div>
    </div>
  )
}
