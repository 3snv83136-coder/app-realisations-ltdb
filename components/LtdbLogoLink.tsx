import Link from 'next/link'

type Variant = 'nav' | 'header' | 'banner' | 'tab'

const STYLES: Record<Variant, string> = {
  nav: 'h-8 w-8',
  header: 'h-12 w-12',
  banner: 'h-9 w-9',
  tab: 'h-7 w-7',
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
      className={`inline-flex ${className}`.trim()}
      title="Retour à l'accueil"
    >
      <img
        src="/logo-ltdb-icon.png"
        alt="Les Techniciens du Débouchage"
        className={`${STYLES[variant]} rounded-lg object-contain`}
      />
    </Link>
  )
}
