import type { Metadata } from "next"
import { Inter, Instrument_Serif } from "next/font/google"
import "./presentation.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
})

export const metadata: Metadata = {
  title: "LTDB — Le CRM des techniciens du débouchage",
  description:
    "Pilotez devis, factures, interventions et inspections caméra depuis le terrain. L'app tout-en-un des Techniciens du Débouchage.",
}

export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${inter.variable} ${instrumentSerif.variable} font-sans`}>
      {children}
    </div>
  )
}
