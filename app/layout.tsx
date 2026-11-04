import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { PwaScript } from "@/components/PwaScript"
import { DemoRevocationGuard } from "@/components/DemoRevocationGuard"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LTDB — Réalisations",
  description: "Back-office techniciens LTDB — Les Techniciens du Débouchage",
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
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
  viewportFit: "cover",
  themeColor: "#0e2a52",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <SessionProvider>
          <DemoRevocationGuard />
          {children}
        </SessionProvider>
        <PwaScript />
      </body>
    </html>
  )
}
