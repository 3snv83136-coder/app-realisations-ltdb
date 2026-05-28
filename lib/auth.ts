import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

function loadUsers() {
  const users: { id: string; name: string }[] = []
  for (let i = 1; i <= 5; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (!entry) continue
    // Format « nom » ou « nom:hash » (le hash est ignoré — connexion sans mot de passe)
    const name = entry.includes(':') ? entry.split(':')[0] : entry
    if (name?.trim()) users.push({ id: String(i), name: name.trim() })
  }
  return users
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Identifiant", type: "text" },
      },
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim()
        if (!username) return null
        const user = loadUsers().find(u => u.name === username)
        if (!user) return null
        return { id: user.id, name: user.name }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
