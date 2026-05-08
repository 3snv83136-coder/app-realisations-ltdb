import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import TechAccessGuard from "@/components/TechAccessGuard"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LTDB — Réalisations",
  description: "Back-office techniciens LTDB",
  robots: "noindex, nofollow",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0e2a52",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <SessionProvider>
          <TechAccessGuard />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
