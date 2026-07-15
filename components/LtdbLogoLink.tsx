import Link from 'next/link'

type Variant = 'nav' | 'header' | 'banner' | 'tab'

const STYLES: Record<Variant, string> = {
  nav: 'font-black text-base sm:text-lg leading-tight hover:opacity-80 transition-opacity',
  header: 'text-xl sm:text-3xl font-black tracking-tight leading-none hover:opacity-80 transition-opacity',
  banner: 'text-xl font-black tracking-tight hover:opacity-80 transition-opacity',
  tab: 'font-black text-sm text-[#0e2a52] hover:opacity-80 transition-opacity shrink-0',
}

export default function LtdbLogoLink({
  variant = 'nav',
  className = '',
}: {
  variant?: Variant
  className?: string
}) {
  return (
    <Link
      href="/"
      className={`${STYLES[variant]} ${className}`.trim()}
      title="Retour à l'accueil"
    >
      LTDB
    </Link>
  )
}
