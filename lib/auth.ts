import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

function loadUsers() {
  const users: { id: string; name: string; hash: string }[] = []
  for (let i = 1; i <= 5; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (entry) {
      const [name, hash] = entry.split(':')
      if (name && hash) users.push({ id: String(i), name, hash })
    }
  }
  return users
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const { username, password } = credentials as { username: string; password: string }
        const users = loadUsers()
        const user = users.find(u => u.name === username)
        if (!user) return null
        const valid = await bcrypt.compare(password, user.hash)
        if (!valid) return null
        return { id: user.id, name: user.name }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
