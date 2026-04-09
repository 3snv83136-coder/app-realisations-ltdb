import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File
  if (!audioFile) return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 })

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "fr",
    prompt: "débouchage, hydrocurage, canalisation, évier, WC, siphon, bouchon, curage, chemisage, inspection caméra, Toulon, Hyères, Var",
  })

  return NextResponse.json({ text: transcription.text })
}
