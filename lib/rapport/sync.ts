/**
 * Synchronisation des dictées et rapports créés hors-ligne.
 * À n'importer que côté client.
 */
import {
  clearRapportDraft,
  getRapportDraft,
  listPendingAudios,
  listPendingRapports,
  pendingAudioToBlob,
  removePendingAudio,
  removePendingRapport,
  saveRapportDraft,
} from "@/lib/rapport/offline-store"

export type RapportSyncResult = {
  transcribed: number
  generated: number
  failed: number
  remaining: number
  syncedInterventionIds: string[]
}

let running = false

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  if (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message)) return true
  return false
}

async function transcribeBlob(blob: Blob, ext: string): Promise<string> {
  const formData = new FormData()
  formData.append('audio', blob, `dictee.${ext}`)
  const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Transcription HTTP ${res.status}`)
  return String(data.text || '').trim()
}

async function generateRapport(input: {
  transcription: string
  type_intervention: string | null
  ville: string | null
  code_postal: string | null
}) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcription: input.transcription,
      type_intervention: input.type_intervention || 'Intervention',
      ville: input.ville || '',
      code_postal: input.code_postal || '',
    }),
    signal: AbortSignal.timeout(180_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Génération HTTP ${res.status}`)
  return { rapport: data.rapport, seo: data.seo }
}

async function saveRapportOnServer(input: {
  interventionId: string
  transcription: string
  rapport: unknown
  seo: unknown
  typeIntervention: string | null
  dateIntervention: string | null
}) {
  const saveRes = await fetch('/api/save-rapport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interventionId: input.interventionId,
      rapport: input.rapport,
      seo: input.seo,
      transcription: input.transcription,
      typeIntervention: input.typeIntervention,
      dateIntervention: input.dateIntervention,
    }),
  })
  const saveData = await saveRes.json().catch(() => ({}))
  if (!saveRes.ok) throw new Error(saveData.error || `Sauvegarde HTTP ${saveRes.status}`)

  await fetch(`/api/interventions/${input.interventionId}/terrain-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set', step: 4 }),
  })
}

async function appendTranscriptionToDraft(interventionId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  const existing = await getRapportDraft(interventionId)
  const merged = existing?.transcription?.trim()
    ? `${existing.transcription.trim()} ${trimmed}`
    : trimmed
  await saveRapportDraft(interventionId, merged)
}

export async function syncPendingRapports(): Promise<RapportSyncResult> {
  const empty: RapportSyncResult = {
    transcribed: 0,
    generated: 0,
    failed: 0,
    remaining: 0,
    syncedInterventionIds: [],
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const [audios, rapports] = await Promise.all([listPendingAudios(), listPendingRapports()])
    return { ...empty, remaining: audios.length + rapports.length }
  }
  if (running) {
    const [audios, rapports] = await Promise.all([listPendingAudios(), listPendingRapports()])
    return { ...empty, remaining: audios.length + rapports.length }
  }

  running = true
  let transcribed = 0
  let generated = 0
  let failed = 0
  const syncedInterventionIds = new Set<string>()

  try {
    for (const item of await listPendingAudios()) {
      try {
        const text = await transcribeBlob(pendingAudioToBlob(item), item.ext)
        await appendTranscriptionToDraft(item.intervention_id, text)
        await removePendingAudio(item.id)
        transcribed++
        syncedInterventionIds.add(item.intervention_id)
      } catch (e) {
        if (isNetworkError(e)) break
        failed++
      }
    }

    for (const item of await listPendingRapports()) {
      try {
        const draft = await getRapportDraft(item.intervention_id)
        const transcription = (draft?.transcription || item.transcription || '').trim()
        if (transcription.length < 20) {
          await removePendingRapport(item.id)
          failed++
          continue
        }
        const { rapport, seo } = await generateRapport({
          transcription,
          type_intervention: item.type_intervention,
          ville: item.ville,
          code_postal: item.code_postal,
        })
        await saveRapportOnServer({
          interventionId: item.intervention_id,
          transcription,
          rapport,
          seo,
          typeIntervention: item.type_intervention,
          dateIntervention: item.date_prevue,
        })
        await removePendingRapport(item.id)
        await clearRapportDraft(item.intervention_id)
        generated++
        syncedInterventionIds.add(item.intervention_id)
      } catch (e) {
        if (isNetworkError(e)) break
        failed++
      }
    }
  } finally {
    running = false
  }

  const [audios, rapports] = await Promise.all([listPendingAudios(), listPendingRapports()])
  return {
    transcribed,
    generated,
    failed,
    remaining: audios.length + rapports.length,
    syncedInterventionIds: Array.from(syncedInterventionIds),
  }
}
