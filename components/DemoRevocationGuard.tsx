'use client'

import { signOut, useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

const CLICKABLE =
  'button, a, [role="button"], input[type="submit"], input[type="button"], label[for], [data-demo-guard]'

/**
 * Comptes démo : à chaque interaction (clic / touche), vérifie que l'accès
 * n'a pas été révoqué — sinon déconnexion immédiate vers /login.
 */
export function DemoRevocationGuard() {
  const { data: session, status } = useSession()
  const checking = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.isDemo) return

    async function ensureActive(e: Event) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (!target.closest(CLICKABLE)) return

      if (checking.current) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return
      }

      checking.current = true
      try {
        const res = await fetch('/api/demo-access/check', { cache: 'no-store' })
        if (!res.ok) {
          e.preventDefault()
          e.stopImmediatePropagation()
          await signOut({ callbackUrl: '/login?revoked=1' })
        }
      } catch {
        /* réseau : on laisse passer pour ne pas bloquer hors-ligne */
      } finally {
        checking.current = false
      }
    }

    document.addEventListener('click', ensureActive, true)
    document.addEventListener('touchend', ensureActive, true)
    return () => {
      document.removeEventListener('click', ensureActive, true)
      document.removeEventListener('touchend', ensureActive, true)
    }
  }, [status, session?.user?.isDemo])

  return null
}
