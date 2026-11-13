import React from "react"
import { Img, staticFile } from "remotion"

/** Logo carré bleu (fichier public de l'application). */
export const LtdbLogoMark: React.FC<{ size: number }> = ({ size }) => {
  return (
    <Img
      src={staticFile("logo-ltdb-icon.png")}
      style={{ width: size, height: size }}
    />
  )
}
