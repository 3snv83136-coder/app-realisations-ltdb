/**
 * Génère un hash bcrypt pour AUTH_TECH_N sur Vercel.
 * Usage : npx tsx scripts/hash-password.ts "MonMotDePasse"
 */
import bcrypt from "bcryptjs"

const pwd = process.argv[2]
if (!pwd) {
  console.error('Usage: npx tsx scripts/hash-password.ts "MonMotDePasse"')
  process.exit(1)
}

bcrypt.hash(pwd, 10).then(hash => {
  console.log("\nHash à coller dans AUTH_TECH_N (login:hash) :\n")
  console.log(hash)
  console.log("\nExemple Vercel : AUTH_TECH_1=jean.dupont:" + hash.replace(/\$/g, "_"))
  console.log("(remplacer $ par _ dans .env si dotenv corrompt le hash)\n")
})
