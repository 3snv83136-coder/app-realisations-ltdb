'use client'

export default function TruckLoader() {
  return (
    <div className="relative h-20 w-full overflow-hidden rounded-xl bg-gradient-to-b from-sky-50 to-blue-100 border border-blue-200">
      <div className="absolute bottom-2.5 left-2 right-2 border-t border-dashed border-blue-300/70" />

      <div className="ltdb-truck absolute bottom-2" style={{ width: 96 }}>
        <svg viewBox="0 0 96 40" className="w-[96px] h-10 overflow-visible">
          <g className="ltdb-hose-coil">
            <circle cx="78" cy="14" r="6" fill="none" stroke="#0e2a52" strokeWidth="2" />
            <circle cx="78" cy="14" r="3" fill="none" stroke="#0e2a52" strokeWidth="1.5" />
          </g>

          <path
            className="ltdb-hose"
            d="M 76 18 Q 92 22 90 32 T 95 36"
            stroke="#0e2a52"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          <circle className="ltdb-hose-tip" cx="95" cy="36" r="2" fill="#1e40af" />

          <rect x="18" y="14" width="58" height="18" rx="3" fill="#0e2a52" />
          <rect x="20" y="16" width="54" height="2" fill="#1e3a8a" opacity="0.6" />
          <circle className="ltdb-bubble" cx="32" cy="13" r="1.8" fill="#fbbf24" />
          <circle className="ltdb-bubble ltdb-bubble-2" cx="48" cy="13" r="1.4" fill="#fbbf24" />

          <rect x="2" y="16" width="16" height="16" rx="2" fill="#1e40af" />
          <rect x="4" y="18" width="6" height="6" fill="#bfdbfe" />
          <rect x="11" y="18" width="5" height="6" fill="#bfdbfe" />

          <circle cx="3" cy="24" r="0.8" fill="#fbbf24" />

          <g className="ltdb-wheel">
            <circle cx="13" cy="34" r="4" fill="#0f172a" />
            <circle cx="13" cy="34" r="1.5" fill="#64748b" />
            <line x1="13" y1="30.5" x2="13" y2="37.5" stroke="#475569" strokeWidth="0.8" />
            <line x1="9.5" y1="34" x2="16.5" y2="34" stroke="#475569" strokeWidth="0.8" />
          </g>
          <g className="ltdb-wheel">
            <circle cx="58" cy="34" r="4" fill="#0f172a" />
            <circle cx="58" cy="34" r="1.5" fill="#64748b" />
            <line x1="58" y1="30.5" x2="58" y2="37.5" stroke="#475569" strokeWidth="0.8" />
            <line x1="54.5" y1="34" x2="61.5" y2="34" stroke="#475569" strokeWidth="0.8" />
          </g>

          <text x="22" y="26" fontSize="6" fontWeight="bold" fill="#fbbf24" letterSpacing="0.5">LTDB</text>
        </svg>
      </div>

      <div className="ltdb-puff absolute" style={{ left: '8%', bottom: 16 }}>
        <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
      </div>

      <style>{`
        @keyframes ltdbTruckMove {
          0%   { left: 4%;  transform: scaleX(1); }
          45%  { left: calc(100% - 100px); transform: scaleX(1); }
          50%  { left: calc(100% - 100px); transform: scaleX(-1); }
          95%  { left: 4%;  transform: scaleX(-1); }
          100% { left: 4%;  transform: scaleX(1); }
        }
        .ltdb-truck { animation: ltdbTruckMove 6s ease-in-out infinite; transform-origin: center; }

        @keyframes ltdbWheelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ltdb-wheel { animation: ltdbWheelSpin 0.6s linear infinite; transform-box: fill-box; transform-origin: center; }

        @keyframes ltdbHoseWave {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-1.5px) rotate(2deg); }
        }
        .ltdb-hose { animation: ltdbHoseWave 0.45s ease-in-out infinite; transform-box: fill-box; transform-origin: 76px 18px; }
        .ltdb-hose-tip { animation: ltdbHoseWave 0.45s ease-in-out infinite reverse; transform-box: fill-box; transform-origin: center; }

        @keyframes ltdbCoilSpin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        .ltdb-hose-coil { animation: ltdbCoilSpin 1.4s linear infinite; transform-box: fill-box; transform-origin: 78px 14px; }

        @keyframes ltdbBubble {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.6); }
          40%      { opacity: 1; transform: translateY(-4px) scale(1); }
          80%      { opacity: 0; transform: translateY(-7px) scale(0.4); }
        }
        .ltdb-bubble { animation: ltdbBubble 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .ltdb-bubble-2 { animation-delay: 0.7s; }

        @keyframes ltdbPuff {
          0%   { opacity: 0.8; transform: translate(0, 0) scale(1); }
          100% { opacity: 0;   transform: translate(-12px, -4px) scale(2); }
        }
        .ltdb-puff { animation: ltdbPuff 1.2s ease-out infinite; }
      `}</style>
    </div>
  )
}
