'use client'
import Link from "next/link"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a1a3d] text-white">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a3d] via-[#0e2a52] to-[#071026]" />

      {/* Shatter cracks (SVG) — fade in after impact */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full opacity-0 cracks-fade-in"
        viewBox="0 0 800 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <g stroke="#1a3a6b" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M400 420 L200 100" />
          <path d="M400 420 L120 200" />
          <path d="M400 420 L600 80" />
          <path d="M400 420 L720 180" />
          <path d="M400 420 L50 500" />
          <path d="M400 420 L750 500" />
          <path d="M400 420 L180 900" />
          <path d="M400 420 L320 980" />
          <path d="M400 420 L500 980" />
          <path d="M400 420 L680 900" />
          <path d="M400 420 L280 300" />
          <path d="M400 420 L520 320" />
          <path d="M400 420 L250 620" />
          <path d="M400 420 L580 630" />
        </g>
      </svg>

      {/* Shockwave ring — expands after impact */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-orange-400 shockwave-ring" />

      {/* Shake wrapper — contenu centré verticalement en flex */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 py-8 gap-6 sm:gap-10 shake-on-impact">

        {/* LTDB logo that crashes onto screen */}
        <div className="ltdb-drop text-center">
          <h1 className="text-[18vw] sm:text-[14vw] md:text-[11rem] lg:text-[13rem] font-black leading-none tracking-tight select-none text-white drop-shadow-[0_8px_30px_rgba(229,115,22,0.5)]">
            LTDB
          </h1>
          <div className="mt-2 text-[9px] sm:text-[11px] md:text-xs uppercase tracking-[0.35em] sm:tracking-[0.4em] text-orange-300/80 font-bold">
            Les Techniciens du Débouchage
          </div>
        </div>

        {/* Three buttons — uniformes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-4xl mx-auto buttons-reveal">

          {[
            { href: '/nouveau',    iconBg: 'bg-[#0e2a52]',   icon: '📄', title: 'Rapport · Mail GMB · Page site' },
            { href: '/devis',      iconBg: 'bg-orange-500',  icon: '🧾', title: 'Devis complet' },
            { href: '/attestation', iconBg: 'bg-[#a78346]',  icon: '⚖',  title: 'Attestation de raccordement' },
          ].map(b => (
            <Link
              key={b.href}
              href={b.href}
              className="group relative bg-white hover:bg-white text-[#0e2a52] rounded-3xl p-5 sm:p-6 text-left shadow-xl hover:shadow-[0_20px_50px_rgba(229,115,22,0.35)] transition-shadow active:scale-[0.98] border-2 border-transparent hover:border-orange-400 min-h-[130px] flex flex-col"
            >
              <div className={`w-12 h-12 rounded-2xl ${b.iconBg} text-white flex items-center justify-center text-2xl mb-3`}>
                {b.icon}
              </div>
              <div className="text-base sm:text-lg font-black leading-tight flex-1">
                {b.title}
              </div>
              <div className="absolute top-4 right-4 text-xl opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        /* ===== LTDB drop animation =====
           Commence hors écran tout en haut, petite pause, tombe rapidement
           avec rotation puis atterrit en place. */
        @keyframes ltdbDrop {
          0%   { opacity: 0; transform: translateY(-120vh) rotate(-8deg) scale(1.5); }
          30%  { opacity: 0; transform: translateY(-120vh) rotate(-8deg) scale(1.5); }
          75%  { opacity: 1; transform: translateY(8px) rotate(2deg) scale(1.02); }
          85%  { transform: translateY(-4px) rotate(-1deg) scale(1); }
          100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
        }
        .ltdb-drop {
          opacity: 0;
          animation: ltdbDrop 1.6s cubic-bezier(.45,.05,.2,1) 0.3s forwards;
          will-change: transform, opacity;
        }

        /* ===== Shake écran après impact ===== */
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-4px, 2px); }
          20% { transform: translate(4px, -2px); }
          30% { transform: translate(-3px, 2px); }
          40% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 1px); }
          60% { transform: translate(2px, -1px); }
          70% { transform: translate(-1px, 1px); }
          80% { transform: translate(1px, 0); }
        }
        .shake-on-impact {
          animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) 1.45s;
        }

        /* ===== Onde de choc orange ===== */
        @keyframes shockwave {
          0%   { width: 0; height: 0; opacity: 0; border-width: 8px; }
          20%  { opacity: 0; }
          25%  { opacity: 0.95; width: 20px; height: 20px; border-width: 8px; }
          100% { width: 150vw; height: 150vw; opacity: 0; border-width: 0; }
        }
        .shockwave-ring {
          width: 0;
          height: 0;
          opacity: 0;
          animation: shockwave 1.4s ease-out 1.4s forwards;
        }

        /* ===== Fissures bleues qui apparaissent ===== */
        @keyframes cracksFade {
          0%, 70% { opacity: 0; }
          100%    { opacity: 0.55; }
        }
        .cracks-fade-in {
          animation: cracksFade 1.2s ease-out 1.4s forwards;
        }

        /* ===== Boutons qui montent après l'impact ===== */
        @keyframes buttonsUp {
          0%, 70% { opacity: 0; transform: translateY(40px); pointer-events: none; }
          100%    { opacity: 1; transform: translateY(0); pointer-events: auto; }
        }
        .buttons-reveal {
          opacity: 0;
          transform: translateY(40px);
          pointer-events: none;
          animation: buttonsUp 0.7s ease-out 1.75s forwards;
        }

        /* Respecter la préférence utilisateur "reduced motion" */
        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop, .shake-on-impact, .shockwave-ring, .cracks-fade-in, .buttons-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            pointer-events: auto !important;
          }
          .cracks-fade-in { opacity: 0.5 !important; }
        }
      `}</style>
    </main>
  )
}
