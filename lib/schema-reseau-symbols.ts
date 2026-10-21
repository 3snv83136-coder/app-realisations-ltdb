/**
 * Banque de symboles techniques pour schémas d’inspection caméra / assainissement.
 * Dessin vectoriel sur canvas (UI + PDF composite).
 */

export type SchemaSymbolKind =
  | 'regard'
  | 'regard_visite'
  | 'boite_branchement'
  | 'canalisation'
  | 'canalisation_ep'
  | 'fleche_ecoulement'
  | 'fleche_inspection'
  | 'vanne'
  | 'siphon'
  | 'fosse'
  | 'poste_relevage'
  | 'branchement'
  | 'culotte'
  | 'tampon'
  | 'batiment'
  | 'nord'

export type SchemaSymbolDef = {
  kind: SchemaSymbolKind
  label: string
  short: string
  category: 'ouvrages' | 'reseaux' | 'sens' | 'equipements' | 'divers'
  /** Taille de base en px CSS (rayon / demi-largeur) */
  size: number
  /** Peut être allongé (canalisation) */
  elongated?: boolean
}

export type SchemaSymbolInstance = {
  id: string
  kind: SchemaSymbolKind
  xPct: number
  yPct: number
  /** Rotation en degrés (0–360) */
  rotationDeg: number
  /** Facteur d’échelle 0.6–1.8 */
  scale: number
  /** Libellé optionnel affiché (ex. R1, BB2) */
  tag?: string
}

export const SCHEMA_SYMBOL_BANK: SchemaSymbolDef[] = [
  { kind: 'regard', label: 'Regard', short: 'R', category: 'ouvrages', size: 22 },
  { kind: 'regard_visite', label: 'Regard de visite', short: 'RV', category: 'ouvrages', size: 22 },
  { kind: 'boite_branchement', label: 'Boîte de branchement', short: 'BB', category: 'ouvrages', size: 18 },
  { kind: 'tampon', label: 'Tampon / plaque', short: 'T', category: 'ouvrages', size: 16 },
  { kind: 'fosse', label: 'Fosse / fosse septique', short: 'FS', category: 'ouvrages', size: 28 },
  { kind: 'poste_relevage', label: 'Poste de relevage', short: 'PR', category: 'ouvrages', size: 24 },
  { kind: 'canalisation', label: 'Canalisation EU', short: 'EU', category: 'reseaux', size: 36, elongated: true },
  { kind: 'canalisation_ep', label: 'Canalisation EP', short: 'EP', category: 'reseaux', size: 36, elongated: true },
  { kind: 'branchement', label: 'Branchement particulier', short: 'Br', category: 'reseaux', size: 28, elongated: true },
  { kind: 'culotte', label: 'Culotte / té', short: 'Y', category: 'reseaux', size: 22 },
  { kind: 'fleche_ecoulement', label: 'Sens d’écoulement', short: '→', category: 'sens', size: 28, elongated: true },
  { kind: 'fleche_inspection', label: 'Sens d’inspection', short: '▶', category: 'sens', size: 28, elongated: true },
  { kind: 'vanne', label: 'Vanne / clapet', short: 'V', category: 'equipements', size: 18 },
  { kind: 'siphon', label: 'Siphon', short: 'S', category: 'equipements', size: 18 },
  { kind: 'batiment', label: 'Bâtiment / habitation', short: 'Hab', category: 'divers', size: 26 },
  { kind: 'nord', label: 'Orientation Nord', short: 'N', category: 'divers', size: 20 },
]

export const SCHEMA_SYMBOL_CATEGORIES: { id: SchemaSymbolDef['category']; label: string }[] = [
  { id: 'ouvrages', label: 'Ouvrages' },
  { id: 'reseaux', label: 'Réseaux' },
  { id: 'sens', label: 'Sens' },
  { id: 'equipements', label: 'Équipements' },
  { id: 'divers', label: 'Divers' },
]

export function getSymbolDef(kind: SchemaSymbolKind): SchemaSymbolDef {
  return SCHEMA_SYMBOL_BANK.find(s => s.kind === kind) || SCHEMA_SYMBOL_BANK[0]
}

const NAVY = '#0e2a52'
const RED = '#c0392b'
const BLUE_EP = '#0369a1'
const SLATE = '#334155'

/** Dessine un symbole centré en (0,0) — le caller gère translate/rotate/scale. */
export function drawSchemaSymbol(
  ctx: CanvasRenderingContext2D,
  kind: SchemaSymbolKind,
  baseSize: number,
  tag?: string,
) {
  const s = baseSize
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (kind) {
    case 'regard':
    case 'regard_visite': {
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = NAVY
      ctx.stroke()
      if (kind === 'regard_visite') {
        ctx.beginPath()
        ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2)
        ctx.stroke()
      }
      // Croix interne légère
      ctx.beginPath()
      ctx.moveTo(-s * 0.35, 0); ctx.lineTo(s * 0.35, 0)
      ctx.moveTo(0, -s * 0.35); ctx.lineTo(0, s * 0.35)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = '#94a3b8'
      ctx.stroke()
      break
    }
    case 'boite_branchement': {
      const w = s * 1.4, h = s * 1.1
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 2.2
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.beginPath()
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0)
      ctx.stroke()
      break
    }
    case 'tampon': {
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.fillStyle = '#cbd5e1'
      ctx.fill()
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = NAVY
      ctx.fill()
      break
    }
    case 'fosse': {
      const w = s * 1.8, h = s * 1.2
      roundRect(ctx, -w / 2, -h / 2, w, h, 4)
      ctx.fillStyle = '#f1f5f9'
      ctx.fill()
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 2.2
      ctx.stroke()
      // Trait niveau
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 4, 0); ctx.lineTo(w / 2 - 4, 0)
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = BLUE_EP
      ctx.stroke()
      ctx.setLineDash([])
      break
    }
    case 'poste_relevage': {
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.fillStyle = '#e0f2fe'
      ctx.fill()
      ctx.strokeStyle = BLUE_EP
      ctx.lineWidth = 2.4
      ctx.stroke()
      // Pompe stylisée
      ctx.beginPath()
      ctx.moveTo(-s * 0.3, s * 0.2)
      ctx.lineTo(0, -s * 0.4)
      ctx.lineTo(s * 0.3, s * 0.2)
      ctx.closePath()
      ctx.fillStyle = BLUE_EP
      ctx.fill()
      break
    }
    case 'canalisation':
    case 'canalisation_ep':
    case 'branchement': {
      const len = s * 2.2
      const thick = kind === 'branchement' ? 4 : kind === 'canalisation_ep' ? 7 : 8
      ctx.strokeStyle = kind === 'canalisation_ep' ? BLUE_EP : NAVY
      ctx.lineWidth = thick
      ctx.beginPath()
      ctx.moveTo(-len / 2, 0)
      ctx.lineTo(len / 2, 0)
      ctx.stroke()
      if (kind === 'branchement') {
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(len * 0.15, -s * 0.7)
        ctx.stroke()
      }
      break
    }
    case 'culotte': {
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(-s, 0); ctx.lineTo(s * 0.2, 0)
      ctx.moveTo(0, 0); ctx.lineTo(s * 0.7, -s * 0.7)
      ctx.moveTo(0, 0); ctx.lineTo(s * 0.7, s * 0.7)
      ctx.stroke()
      break
    }
    case 'fleche_ecoulement':
    case 'fleche_inspection': {
      const len = s * 2
      const color = kind === 'fleche_inspection' ? RED : BLUE_EP
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = kind === 'fleche_inspection' ? 3 : 4
      ctx.beginPath()
      ctx.moveTo(-len / 2, 0)
      ctx.lineTo(len / 2 - 8, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(len / 2, 0)
      ctx.lineTo(len / 2 - 14, -8)
      ctx.lineTo(len / 2 - 14, 8)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'vanne': {
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-s * 0.5, -s * 0.55)
      ctx.lineTo(s * 0.5, s * 0.55)
      ctx.moveTo(-s * 0.5, s * 0.55)
      ctx.lineTo(s * 0.5, -s * 0.55)
      ctx.stroke()
      break
    }
    case 'siphon': {
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(-s, -s * 0.3)
      ctx.quadraticCurveTo(-s * 0.2, s, s * 0.2, s)
      ctx.quadraticCurveTo(s, s, s, -s * 0.3)
      ctx.stroke()
      break
    }
    case 'batiment': {
      const w = s * 1.6, h = s * 1.3
      ctx.fillStyle = '#f8fafc'
      ctx.strokeStyle = SLATE
      ctx.lineWidth = 2
      ctx.fillRect(-w / 2, -h / 2 + 4, w, h - 4)
      ctx.strokeRect(-w / 2, -h / 2 + 4, w, h - 4)
      // Toit
      ctx.beginPath()
      ctx.moveTo(-w / 2 - 2, -h / 2 + 4)
      ctx.lineTo(0, -h / 2 - 6)
      ctx.lineTo(w / 2 + 2, -h / 2 + 4)
      ctx.closePath()
      ctx.fillStyle = NAVY
      ctx.fill()
      break
    }
    case 'nord': {
      ctx.fillStyle = NAVY
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.35, s * 0.2)
      ctx.lineTo(0, 0)
      ctx.lineTo(-s * 0.35, s * 0.2)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = RED
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.35, s * 0.2)
      ctx.lineTo(0, 0)
      ctx.closePath()
      ctx.fill()
      break
    }
    default:
      break
  }

  // Tag sous le symbole
  if (tag) {
    ctx.fillStyle = NAVY
    ctx.font = `bold ${Math.max(10, Math.round(s * 0.55))}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(tag, 0, s + 4)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Dessine une instance placée (coordonnées absolues canvas). */
export function paintSymbolInstance(
  ctx: CanvasRenderingContext2D,
  sym: SchemaSymbolInstance,
  canvasW: number,
  canvasH: number,
) {
  const def = getSymbolDef(sym.kind)
  const x = (sym.xPct / 100) * canvasW
  const y = (sym.yPct / 100) * canvasH
  const size = def.size * (sym.scale || 1) * (canvasW / 800)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((sym.rotationDeg * Math.PI) / 180)
  drawSchemaSymbol(ctx, sym.kind, size, sym.tag)
  ctx.restore()
}

/** Miniature pour la palette UI (retourne data URL). */
export function symbolPreviewDataUrl(kind: SchemaSymbolKind, px = 64): string {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, px, px)
  ctx.translate(px / 2, px / 2)
  const def = getSymbolDef(kind)
  drawSchemaSymbol(ctx, kind, def.size * (px / 72) * 0.85)
  return canvas.toDataURL('image/png')
}
