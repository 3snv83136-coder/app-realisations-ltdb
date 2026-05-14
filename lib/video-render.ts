import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"

export type VideoFormat = "vertical" | "horizontal" | "square"

const COMPOSITION_ID: Record<VideoFormat, string> = {
  vertical: "InterventionVertical",
  horizontal: "InterventionHorizontal",
  square: "InterventionSquare",
}

export type RenderInput = {
  format: VideoFormat
  photos: { url: string; caption?: string }[]
  ville?: string
  typeIntervention?: string
  clientNom?: string
  dateRealisee?: string
  enableMusic?: boolean
}

let bundlePromise: Promise<string> | null = null

function getBundle(): Promise<string> {
  if (bundlePromise) return bundlePromise
  bundlePromise = bundle({
    entryPoint: path.resolve(process.cwd(), "remotion/index.ts"),
    publicDir: path.resolve(process.cwd(), "remotion/assets"),
    onProgress: () => {},
  })
  return bundlePromise
}

export async function renderVideoLocal(input: RenderInput): Promise<{ filePath: string; bytes: number }> {
  const serveUrl = await getBundle()
  const inputProps = {
    format: input.format,
    photos: input.photos,
    ville: input.ville,
    typeIntervention: input.typeIntervention,
    clientNom: input.clientNom,
    dateRealisee: input.dateRealisee,
    enableMusic: input.enableMusic ?? true,
  }

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID[input.format],
    inputProps,
  })

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ltdb-video-"))
  const filePath = path.join(tmpDir, `${input.format}.mp4`)

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: filePath,
    inputProps,
    overwrite: true,
    videoBitrate: "3M",
    x264Preset: "veryfast",
  })

  const stat = await fs.stat(filePath)
  return { filePath, bytes: stat.size }
}

export async function renderVideo(input: RenderInput) {
  const lambdaFn = process.env.REMOTION_LAMBDA_FUNCTION_NAME
  if (lambdaFn) {
    throw new Error("Lambda mode not implemented yet — Phase 2bis")
  }
  return renderVideoLocal(input)
}
