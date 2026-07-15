import type { AuthRole } from "@/lib/auth-users"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role?: AuthRole
    technicienId?: string | null
    isDemo?: boolean
    isDbTech?: boolean
  }
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: AuthRole
      technicienId?: string | null
      isDemo?: boolean
      isDbTech?: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AuthRole
    technicienId?: string | null
    isDemo?: boolean
    isDbTech?: boolean
  }
}
