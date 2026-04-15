'use client'
import { useMemo } from "react"

type Props = {
  open: boolean
  onClose: () => void
  seo: any
  ville: string
  photos: { dataUrl: string; legende: string }[]
}

export default function SitePreviewModal({ open, onClose, seo, ville, photos }: Props) {
  const html = useMemo(() => {
    if (!seo) return ''
    const escape = (s: string) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const gallery = photos.length > 0
      ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><div class="photo-grid">${photos.map((p, i) => `<figure class="photo-card"><img src="${p.dataUrl}" alt="${escape(p.legende || `Photo ${i + 1}`)}"/><figcaption>${escape(p.legende || `Photo ${i + 1}`)}</figcaption></figure>`).join('')}</div></section>`
      : ''
    // Inject photo URLs into {PHOTO_N_URL} placeholders if present
    let content = seo.contenu_principal || ''
    photos.forEach((p, i) => {
      content = content.replaceAll(`{PHOTO_${i + 1}_URL}`, p.dataUrl)
    })
    const resume = seo.resume_rich_snippet ? `<section class="content-block resume-block"><h2>Résumé</h2><p>${escape(seo.resume_rich_snippet)}</p></section>` : ''
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(seo.titre_h1 || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #f4f6fa; line-height: 1.6; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; box-shadow: 0 4px 30px rgba(0,0,0,.08); }
  header.hero { background: linear-gradient(135deg, #0e2a52, #2c5fa8); color: #fff; padding: 40px 32px; }
  header.hero .eyebrow { font-size: 13px; opacity: .8; text-transform: uppercase; letter-spacing: 1px; }
  header.hero h1 { margin: 8px 0 12px; font-size: 30px; line-height: 1.2; }
  header.hero .meta { font-size: 14px; opacity: .85; }
  main { padding: 32px; }
  .meta-desc { font-size: 14px; color: #64748b; font-style: italic; padding: 12px 16px; background: #f1f5f9; border-left: 3px solid #e67e22; border-radius: 4px; margin-bottom: 24px; }
  .content-block { margin-bottom: 28px; padding: 22px 24px; background: #fafbfc; border-radius: 10px; border: 1px solid #e1e6ef; }
  .content-block h2 { color: #0e2a52; margin: 0 0 12px; font-size: 22px; border-bottom: 2px solid #e67e22; padding-bottom: 6px; display: inline-block; }
  .content-block h3 { color: #1a3a6b; margin: 16px 0 8px; font-size: 17px; }
  .content-block p { margin: 8px 0; }
  .content-block a { color: #e67e22; font-weight: 600; text-decoration: none; }
  .content-block a:hover { text-decoration: underline; }
  .info-box { background: #e7f1fa; border-left: 4px solid #2980b9; padding: 14px 18px; border-radius: 6px; margin: 14px 0; }
  .checklist-box { background: #e6f4ea; border-left: 4px solid #1e8449; padding: 14px 18px; border-radius: 6px; margin: 14px 0; }
  .checklist-box ul { margin: 4px 0; padding-left: 20px; }
  .resume-block { background: #fef0e0; border-color: #e67e22; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 14px; }
  .photo-card { margin: 0; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e1e6ef; }
  .photo-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
  .photo-card figcaption { padding: 10px; font-size: 12px; color: #64748b; font-weight: 600; }
  .faq { background: #0e2a52; color: #fff; padding: 32px; }
  .faq h2 { margin: 0 0 20px; }
  .faq details { background: rgba(255,255,255,.08); padding: 14px 18px; border-radius: 8px; margin-bottom: 10px; }
  .faq summary { font-weight: 700; cursor: pointer; }
  .faq details p { margin: 10px 0 0; opacity: .9; font-size: 14px; }
  footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
</style>
</head><body>
<div class="page">
  <header class="hero">
    <div class="eyebrow">Réalisation · ${escape(ville)}</div>
    <h1>${escape(seo.titre_h1 || '')}</h1>
    <div class="meta">Les Techniciens du Débouchage · 07 83 63 68 35</div>
  </header>
  <main>
    ${seo.meta_description ? `<div class="meta-desc">${escape(seo.meta_description)}</div>` : ''}
    ${resume}
    ${content}
    ${gallery}
  </main>
  ${(seo.faq || []).length > 0 ? `<section class="faq"><h2>Questions fréquentes</h2>${seo.faq.map((f: any) => `<details><summary>${escape(f.question)}</summary><p>${escape(f.reponse)}</p></details>`).join('')}</section>` : ''}
  <footer>Aperçu — lestechniciensdudebouchage.fr</footer>
</div>
</body></html>`
  }, [seo, ville, photos])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-3 border-b bg-slate-50">
          <h3 className="font-black text-[#0e2a52] text-lg">🌐 Aperçu page web</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 bg-slate-100">
          <iframe srcDoc={html} className="w-full h-full border-0" sandbox="allow-same-origin" title="Aperçu page site" />
        </div>
      </div>
    </div>
  )
}
