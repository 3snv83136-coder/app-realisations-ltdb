import { redirect } from "next/navigation"

/** Raccourci : ouvre directement le PDF Mirabella prêt. */
export default function MirabellaPdfPage() {
  redirect("/recup/ITV-20260724-1513-mirabella.pdf")
}
