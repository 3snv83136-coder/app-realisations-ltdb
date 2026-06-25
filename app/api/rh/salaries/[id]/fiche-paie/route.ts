import { NextRequest, NextResponse } from "next/server"
import { createElement, type ReactElement } from "react"
import { getSupabaseOrNull } from "@/lib/supabase"
import { requireAdminApi } from "@/lib/rh/require-admin"
import type { Salarie } from "@/lib/rh/types"
import { BulletinPaieDocument, bulletinPaieFilename } from "@/components/rh/BulletinPaiePDF"
import { calculerBulletinPaie, type FichePaieInput } from "@/lib/rh/fiche-paie-calc"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data, error } = await sb
    .from('fiches_paie')
    .select('id, periode_annee, periode_mois, brut, net_a_payer, net_imposable, created_at')
    .eq('salarie_id', params.id)
    .order('periode_annee', { ascending: false })
    .order('periode_mois', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fiches: data || [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: FichePaieInput & { remplacer?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const mois = Number(body.mois)
  const annee = Number(body.annee)
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    return NextResponse.json({ error: 'Mois invalide (1-12)' }, { status: 400 })
  }
  if (!Number.isInteger(annee) || annee < 2020 || annee > 2100) {
    return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
  }

  const { data: salarie, error: salErr } = await sb.from('salaries').select('*').eq('id', params.id).maybeSingle()
  if (salErr) return NextResponse.json({ error: salErr.message }, { status: 500 })
  if (!salarie) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })

  const brutRef = Number(salarie.salaire_brut_mensuel)
  if (!brutRef && !body.salaireBase) {
    return NextResponse.json({ error: 'Renseigne le salaire brut dans le dossier ou dans le formulaire.' }, { status: 400 })
  }

  const { data: existante } = await sb
    .from('fiches_paie')
    .select('id')
    .eq('salarie_id', params.id)
    .eq('periode_annee', annee)
    .eq('periode_mois', mois)
    .maybeSingle()

  if (existante && !body.remplacer) {
    return NextResponse.json({
      error: `Une fiche existe déjà pour ${mois}/${annee}. Coche « Remplacer » pour regénérer.`,
      code: 'DUPLICATE',
    }, { status: 409 })
  }

  const { data: anterieures } = await sb
    .from('fiches_paie')
    .select('brut, net_imposable, net_a_payer, heures, charges_patronales, periode_mois')
    .eq('salarie_id', params.id)
    .eq('periode_annee', annee)
    .lt('periode_mois', mois)

  const cumulsAnterieurs = (anterieures || []).reduce(
    (acc, f) => ({
      brut: acc.brut + Number(f.brut || 0),
      netImposable: acc.netImposable + Number(f.net_imposable || 0),
      netAPayer: acc.netAPayer + Number(f.net_a_payer || 0),
      heures: acc.heures + Number(f.heures || 0),
      chargesPatronales: acc.chargesPatronales + Number(f.charges_patronales || 0),
    }),
    { brut: 0, netImposable: 0, netAPayer: 0, heures: 0, chargesPatronales: 0 },
  )

  const bulletin = calculerBulletinPaie(body, brutRef || Number(body.salaireBase), cumulsAnterieurs)

  const row = {
    salarie_id: params.id,
    periode_annee: annee,
    periode_mois: mois,
    brut: bulletin.brut,
    net_a_payer: bulletin.netAPayer,
    net_imposable: bulletin.netImposable,
    charges_salariales: bulletin.totalRetenuesSalariales,
    charges_patronales: bulletin.totalChargesPatronales,
    heures: bulletin.heures,
    detail_json: bulletin,
  }

  if (existante) {
    await sb.from('fiches_paie').update(row).eq('id', existante.id)
  } else {
    await sb.from('fiches_paie').insert(row)
  }

  await sb.from('salarie_documents_generes').insert({
    salarie_id: params.id,
    type: 'fiche_paie',
    metadata: { annee, mois, netAPayer: bulletin.netAPayer },
  })

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buf = await renderToBuffer(
    createElement(BulletinPaieDocument, {
      salarie: salarie as Salarie,
      bulletin,
    }) as ReactElement,
  )

  const filename = bulletinPaieFilename(salarie as Salarie, mois, annee)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
