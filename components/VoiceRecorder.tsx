'use client'
import { useState, useRef } from "react"
import { savePendingAudio } from "@/lib/rapport/offline-store"

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
  /** Si fourni, les dictées sans réseau sont mises en file d'attente. */
  interventionId?: string
  onOfflineQueued?: () => void
}

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  if (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message)) return true
  return false
}

export default function VoiceRecorder({ onTranscription, interventionId, onOfflineQueued }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [offlineOk, setOfflineOk] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef({ mime: '', ext: 'webm' })

  function pickMimeType(): { mime: string; ext: string } {
    if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' }
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/mp4', ext: 'mp4' },
      { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'mp4' },
      { mime: 'audio/aac', ext: 'aac' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    ]
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c
    }
    return { mime: '', ext: 'webm' }
  }

  async function startRecording() {
    setError('')
    setOfflineOk(false)
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone non accessible. Sur iOS, l'app doit être servie en HTTPS et autorisée.")
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error("Enregistrement vocal non supporté sur ce navigateur. Saisissez le rapport au clavier.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const { mime, ext } = pickMimeType()
      mimeRef.current = { mime, ext }
      const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setProcessing(true)
        try {
          const { mime, ext } = mimeRef.current
          const blobType = mediaRecorder.mimeType || mime || `audio/${ext}`
          const blob = new Blob(chunksRef.current, { type: blobType })

          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            if (!interventionId) {
              throw new Error('Hors connexion : saisis le rapport au clavier ou réessaie avec le réseau.')
            }
            await savePendingAudio({ interventionId, blob, mimeType: blobType, ext })
            setOfflineOk(true)
            onOfflineQueued?.()
            return
          }

          const formData = new FormData()
          formData.append('audio', blob, `dictee.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Transcription échouée')
          onTranscription(data.text)
        } catch (e: unknown) {
          const { mime, ext } = mimeRef.current
          const blobType = mediaRecorderRef.current?.mimeType || mime || `audio/${ext}`
          const blob = new Blob(chunksRef.current, { type: blobType })
          if (interventionId && isOfflineError(e) && blob.size > 0) {
            try {
              await savePendingAudio({ interventionId, blob, mimeType: blobType, ext })
              setOfflineOk(true)
              onOfflineQueued?.()
              return
            } catch {
              /* fallback message ci-dessous */
            }
          }
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Erreur transcription : ${msg}`)
        } finally {
          setProcessing(false)
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || "Impossible de démarrer l'enregistrement.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3.5 sm:py-2 rounded-xl font-bold text-white min-h-[52px] sm:min-h-[44px] text-base ${
            recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-700 hover:bg-blue-800'
          } disabled:opacity-50`}
        >
          {recording ? '⏹ Arrêter la dictée' : '🎤 Dicter le rapport'}
        </button>
        {processing && <span className="text-gray-500 text-sm text-center sm:text-left">Traitement en cours…</span>}
      </div>
      {offlineOk && (
        <p className="text-sm font-semibold text-emerald-700">
          ✓ Audio enregistré hors ligne — transcription automatique au retour du réseau.
        </p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!interventionId && typeof navigator !== 'undefined' && !navigator.onLine && (
        <p className="text-xs text-amber-800">
          Sans réseau, tu peux taper le rapport ci-dessous. La dictée vocale nécessite une intervention terrain.
        </p>
      )}
    </div>
  )
}
