import path from "node:path"
import { isVercelServerless } from "@/lib/remotion-serverless-env"

export type ServerlessChromiumConfig = {
  browserExecutable: string
  chromiumArgs: string[]
}

let cached: ServerlessChromiumConfig | null = null

/**
 * Chromium packagé pour AWS Lambda / Vercel (libs NSS incluses).
 * Nécessite AWS_LAMBDA_JS_RUNTIME=nodejs22.x (vercel.json ou dashboard).
 */
export async function getServerlessChromiumConfig(): Promise<ServerlessChromiumConfig | null> {
  if (!isVercelServerless()) return null
  if (cached) return cached

  // @sparticuz/chromium lit cette variable à l'import du module
  if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
    process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x"
  }

  const chromium = (await import("@sparticuz/chromium")).default
  const executablePath = await chromium.executablePath()
  const execDir = path.dirname(executablePath)

  const libPaths = [
    "/tmp/al2023/lib",
    "/tmp/al2/lib",
    execDir,
    process.env.LD_LIBRARY_PATH,
  ].filter(Boolean) as string[]

  process.env.LD_LIBRARY_PATH = [...new Set(libPaths)].join(":")

  cached = {
    browserExecutable: executablePath,
    chromiumArgs: chromium.args,
  }
  return cached
}
