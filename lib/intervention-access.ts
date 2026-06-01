import { auth } from "@/lib/auth"
import { getSupabaseOrNull } from "@/lib/supabase"

export type SessionUser = {
  role?: "admin" | "tech"
  technicienId?: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user) return null
  return {
    role: session.user.role,
    technicienId: session.user.technicienId ?? null,
  }
}

/** Filtre technicien pour les listes (null = pas de filtre admin). */
export function technicienFilterForSession(user: SessionUser | null): string | null {
  if (user?.role === "tech" && user.technicienId) return user.technicienId
  return null
}

export async function assertInterventionAccess(
  interventionId: string,
  user: SessionUser | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!user) return { ok: false, status: 401, error: "Non authentifié" }
  if (user.role !== "tech" || !user.technicienId) return { ok: true }

  const sb = getSupabaseOrNull()
  if (!sb) return { ok: false, status: 500, error: "Supabase non configuré" }

  const { data, error } = await sb
    .from("interventions")
    .select("technicien_id")
    .eq("id", interventionId)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: "Intervention introuvable" }
  if (data.technicien_id !== user.technicienId) {
    return { ok: false, status: 403, error: "Accès refusé à cette intervention" }
  }
  return { ok: true }
}
