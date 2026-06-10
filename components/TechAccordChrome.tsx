'use client'

import { useSession } from "next-auth/react"
import TechNav from "@/components/TechNav"

/** Barre de navigation technicien sur les pages accord (fin de mois). */
export default function TechAccordChrome() {
  const { data: session } = useSession()
  if (session?.user?.role !== "tech") return null
  return <TechNav />
}
