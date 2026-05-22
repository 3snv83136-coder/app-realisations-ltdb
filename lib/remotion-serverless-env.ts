import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/** Racine du projet (stable même si process.chdir() est appelé). */
export const REMOTION_PROJECT_ROOT = path.resolve(
  process.env.REMOTION_PROJECT_ROOT ?? process.cwd(),
)

export function isVercelServerless(): boolean {
  return process.env.VERCEL === "1"
}

/**
 * Sur Vercel, /var/task est en lecture seule. Remotion place le cache Chrome
 * dans node_modules/.remotion (via process.cwd()). En se plaçant dans /tmp,
 * le cache devient /tmp/.remotion (écritable).
 */
export async function withWritableRemotionCache<T>(fn: () => Promise<T>): Promise<T> {
  if (!isVercelServerless()) {
    return fn()
  }

  const tmp = os.tmpdir()
  const previousCwd = process.cwd()
  process.chdir(tmp)
  fs.mkdirSync(path.join(tmp, ".remotion"), { recursive: true })

  try {
    return await fn()
  } finally {
    process.chdir(previousCwd)
  }
}
