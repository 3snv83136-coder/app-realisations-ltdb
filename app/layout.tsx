import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import TechAccessGuard from "@/components/TechAccessGuard"
import { PwaScript } from "@/components/PwaScript"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LTDB — Réalisations",
  description: "Back-office techniciens LTDB — Les Techniciens du Débouchage",
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  icons: {
    icon: "https://lestechniciensdudebouchage.fr/icons/icon-1024x1024.png",
    apple: "https://lestechniciensdudebouchage.fr/icons/icon-512x512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LTDB",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
        <PwaScript />
      </body>
    </html>
  )
}
