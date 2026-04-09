'use client'
import { useState, useRef } from "react"

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
}

export default function VoiceRecorder({ onTranscription }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setError('')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setProcessing(true)
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'dictee.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Transcription échouée')
        const { text } = await res.json()
        onTranscription(text)
      } catch (e) {
        setError('Erreur transcription. Vérifiez la clé OPENAI_API_KEY.')
      } finally {
        setProcessing(false)
      }
    }

    mediaRecorder.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white ${
            recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-700 hover:bg-blue-800'
          } disabled:opacity-50`}
        >
          {recording ? '⏹ Arrêter la dictée' : '🎤 Dicter le rapport'}
        </button>
        {processing && <span className="text-gray-500 text-sm">Transcription en cours...</span>}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}
