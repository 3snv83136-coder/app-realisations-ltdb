import { NextResponse } from "next/server"
import { listGmbPosts } from "@/lib/gmb"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const auth = await requireAdminApi()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const posts = await listGmbPosts()
    return NextResponse.json({ ok: true, posts })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur liste posts GMB", posts: [] },
      { status: 500 },
    )
  }
}
