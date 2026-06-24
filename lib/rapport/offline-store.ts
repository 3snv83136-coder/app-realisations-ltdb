/**
 * Brouillons et file d'attente hors-ligne des rapports terrain (IndexedDB).
 * À n'importer que côté client.
 */

export type RapportDraft = {
  intervention_id: string
  transcription: string
  updated_at: string
}

export type PendingAudio = {
  id: string
  intervention_id: string
  audio: ArrayBuffer
  mime_type: string
  ext: string
  created_at: string
}

export type PendingRapport = {
  id: string
  intervention_id: string
  transcription: string
  type_intervention: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  created_at: string
}

const DB_NAME = 'ltdb-rapports-offline'
const DB_VERSION = 1
const STORES = {
  drafts: 'drafts',
  audios: 'pending_audios',
  rapports: 'pending_rapports',
} as const

type StoreName = (typeof STORES)[keyof typeof STORES]

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.drafts)) {
        db.createObjectStore(STORES.drafts, { keyPath: 'intervention_id' })
      }
      if (!db.objectStoreNames.contains(STORES.audios)) {
        db.createObjectStore(STORES.audios, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.rapports)) {
        db.createObjectStore(STORES.rapports, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Ouverture IndexedDB échouée'))
  })
}

function tx<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const request = run(transaction.objectStore(storeName))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('Opération IndexedDB échouée'))
        transaction.oncomplete = () => db.close()
      }),
  )
}

export async function saveRapportDraft(interventionId: string, transcription: string): Promise<void> {
  const record: RapportDraft = {
    intervention_id: interventionId,
    transcription,
    updated_at: new Date().toISOString(),
  }
  await tx(STORES.drafts, 'readwrite', store => store.put(record))
}

export async function getRapportDraft(interventionId: string): Promise<RapportDraft | null> {
  const row = await tx<RapportDraft | undefined>(STORES.drafts, 'readonly', store =>
    store.get(interventionId),
  )
  return row ?? null
}

export async function clearRapportDraft(interventionId: string): Promise<void> {
  await tx(STORES.drafts, 'readwrite', store => store.delete(interventionId))
}

export async function savePendingAudio(input: {
  interventionId: string
  blob: Blob
  mimeType: string
  ext: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const audio = await input.blob.arrayBuffer()
  const record: PendingAudio = {
    id,
    intervention_id: input.interventionId,
    audio,
    mime_type: input.mimeType,
    ext: input.ext,
    created_at: new Date().toISOString(),
  }
  await tx(STORES.audios, 'readwrite', store => store.put(record))
  return id
}

export async function listPendingAudios(interventionId?: string): Promise<PendingAudio[]> {
  const all = await tx<PendingAudio[]>(STORES.audios, 'readonly', store => store.getAll())
  const rows = (all || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
  return interventionId ? rows.filter(r => r.intervention_id === interventionId) : rows
}

export async function removePendingAudio(id: string): Promise<void> {
  await tx(STORES.audios, 'readwrite', store => store.delete(id))
}

export async function savePendingRapport(input: Omit<PendingRapport, 'id' | 'created_at'>): Promise<string> {
  const id = crypto.randomUUID()
  const record: PendingRapport = {
    ...input,
    id,
    created_at: new Date().toISOString(),
  }
  await tx(STORES.rapports, 'readwrite', store => store.put(record))
  return id
}

export async function listPendingRapports(interventionId?: string): Promise<PendingRapport[]> {
  const all = await tx<PendingRapport[]>(STORES.rapports, 'readonly', store => store.getAll())
  const rows = (all || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
  return interventionId ? rows.filter(r => r.intervention_id === interventionId) : rows
}

export async function removePendingRapport(id: string): Promise<void> {
  await tx(STORES.rapports, 'readwrite', store => store.delete(id))
}

export async function countPendingRapportItems(interventionId?: string): Promise<number> {
  try {
    const [audios, rapports] = await Promise.all([
      listPendingAudios(interventionId),
      listPendingRapports(interventionId),
    ])
    return audios.length + rapports.length
  } catch {
    return 0
  }
}

export function pendingAudioToBlob(item: PendingAudio): Blob {
  return new Blob([item.audio], { type: item.mime_type || `audio/${item.ext}` })
}
