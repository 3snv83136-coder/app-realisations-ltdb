import path from "node:path"
import { bundle } from "@remotion/bundler"
import { REMOTION_PROJECT_ROOT } from "@/lib/remotion-serverless-env"

/** Bundling à la volée — dev local uniquement (non importé sur Vercel). */
export function bundleRemotionProject(): Promise<string> {
  return bundle({
    entryPoint: path.join(REMOTION_PROJECT_ROOT, "remotion/index.ts"),
    publicDir: path.join(REMOTION_PROJECT_ROOT, "remotion/assets"),
    enableCaching: true,
    onProgress: () => {},
  })
}
