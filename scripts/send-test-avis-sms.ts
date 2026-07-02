import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { sendSmsBrevo } from "../lib/sms-brevo"
import { buildReviewOnlySmsText } from "../lib/review-url"

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    if (!process.env[key]) {
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, "")
    }
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const to = process.argv[2] || ""
if (!to) {
  console.error("Usage: npx tsx scripts/send-test-avis-sms.ts <telephone>")
  process.exit(1)
}

const reviewUrl =
  process.env.GOOGLE_REVIEW_URL || "https://g.page/r/CascWzNKHgyEEAE/review"
const tel = "07 83 63 68 35"
const message = buildReviewOnlySmsText({ reviewUrl, tel })

console.log(`Destinataire: ${to}`)
console.log(`Message (${message.length} car.):\n${message}\n`)

;(async () => {
  const r = await sendSmsBrevo({ to, content: message })
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 1)
})()
