import { auth } from '@/lib/auth'

/** Admin permanent uniquement — pas les comptes démo client. */
export async function requireOwnerAdminApi() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, status: 401, error: 'Non authentifié' }
  }
  if (session.user.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Accès réservé à l\'administrateur' }
  }
  if (session.user.isDemo) {
    return { ok: false as const, status: 403, error: 'Réservé au gérant — pas aux accès démo' }
  }
  return { ok: true as const, session }
}
