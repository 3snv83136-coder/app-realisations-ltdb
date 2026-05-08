'use client'
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

const ALLOWED_PREFIXES = ['/nouveau', '/login']

export default function TechAccessGuard() {
  const router = useRouter()
  const pathname = usePathname() || ''

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_tech_only') !== '1') return
    const allowed = ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!allowed) router.replace('/nouveau')
  }, [pathname, router])

  return null
}
