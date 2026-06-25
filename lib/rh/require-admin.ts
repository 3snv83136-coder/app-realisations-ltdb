import { auth } from "@/lib/auth"

export async function requireAdminApi() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, status: 401, error: 'Non authentifié' }
  }
  if (session.user.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Accès réservé à l\'administrateur' }
  }
  return { ok: true as const, session }
}
