'use client'

/**
 * Rapport externe — étoffer le site sans fiche client / intervention.
 * Flux : texte + photos avant/après → génération SEO → pub site → pub GMB.
 */
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import AppTabs from "@/components/AppTabs"
import VilleCombobox from "@/components/VilleCombobox"
import { buildPublishContentHtml } from "@/lib/publish-content"
import { buildPublishDescription } from "@/lib/publish-description"
import { prepareSeoForPublish } from "@/lib/publish-seo-prepare"
import {
  finalizeMetaDescription,
  finalizeMetaTitle,
  finalizeTitreH1,
} from "@/lib/publish-seo-text"
import { buildCityPageUrl } from "@/lib/seo-normalize"
import { resolvePostalCodeForPublish } from "@/lib/postal-code"
import { formatTechnicienNom } from "@/lib/technicien-nom"
import { findVilleByName } from "@/lib/villes-var"
import { errorMessage } from "@/lib/error-message"
import { REALISATION_PAGE_STYLE } from "@/lib/realisationPageCss"
import type { RapportData, SeoData } from "@/lib/types-documents"

const TYPES = [
  { v: "Débouchage canalisation", icon: "🔧" },
  { v: "Débouchage WC", icon: "🚽" },
  { v: "Débouchage évier", icon: "🍽" },
  { v: "Débouchage douche", icon: "🚿" },
  { v: "Hydrocurage", icon: "💦" },
  { v: "Inspection caméra", icon: "📹" },
  { v: "Vidange fosse septique", icon: "🛢" },
  { v: "Curage canalisation", icon: "⚙" },
]

type PhotoSlot = { file: File; preview: string; dataUrl: string }

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error("Lecture fichier impossible"))
    r.readAsDataURL(file)
  })
}

async function compressImage(file: File, maxDim = 1280, quality = 0.72): Promise<File> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
}

export default function RapportExternePage() {
  const { data: session } = useSession()

  const [typeIntervention, setTypeIntervention] = useState(TYPES[0].v)
  const [ville, setVille] = useState("")
  const [codePostal, setCodePostal] = useState("")
  const [texte, setTexte] = useState("")
  const [dateIntervention, setDateIntervention] = useState(
    () => new Date().toISOString().split("T")[0],
  )
  const [technicienNom, setTechnicienNom] = useState("")
  const [avant, setAvant] = useState<PhotoSlot | null>(null)
  const [apres, setApres] = useState<PhotoSlot | null>(null)

  const [busy, setBusy] = useState<"generate" | "site" | "gmb" | null>(null)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [seo, setSeo] = useState<SeoData | null>(null)
  const [rapport, setRapport] = useState<RapportData | null>(null)
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null)
  const [interventionId, setInterventionId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [siteDone, setSiteDone] = useState(false)
  const [gmbDone, setGmbDone] = useState(false)

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ltdb_technicien") : null
    setTechnicienNom(formatTechnicienNom(saved || session?.user?.name || "Mondor"))
  }, [session?.user?.name])

  async function loadPhoto(
    file: File | null,
    setter: (p: PhotoSlot | null) => void,
  ) {
    if (!file) return
    setError("")
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataUrl(compressed)
      const preview = URL.createObjectURL(compressed)
      setter({ file: compressed, preview, dataUrl })
    } catch (e) {
      setError(`Photo : ${errorMessage(e)}`)
    }
  }

  async function handleGenerate() {
    if (!texte.trim() || !ville.trim()) {
      setError("Renseigne le texte et la ville.")
      return
    }
    const cp = resolvePostalCodeForPublish({
      codePostal,
      ville,
      findVilleCp: (v) => findVilleByName(v)?.cp,
    })
    if (!cp) {
      setError("Code postal manquant — choisis une ville du Var (5 chiffres).")
      return
    }
    setCodePostal(cp)
    setBusy("generate")
    setError("")
    setInfo("")
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription: texte.trim(),
          type_intervention: typeIntervention,
          ville,
          code_postal: cp,
          technicien_nom: formatTechnicienNom(technicienNom),
        }),
        signal: AbortSignal.timeout(180_000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Génération échouée")
      setRapport(data.rapport)
      setSeo(data.seo)
      setInfo("Texte SEO prêt — tu peux publier sur le site.")
    } catch (e) {
      setError(errorMessage(e) || "Erreur génération")
    } finally {
      setBusy(null)
    }
  }

  async function handlePublishSite() {
    if (!avant) {
      setError("Ajoute au moins la photo Avant.")
      return
    }
    if (!texte.trim() || !ville.trim()) {
      setError("Renseigne le texte et la ville.")
      return
    }

    setBusy("site")
    setError("")
    setInfo("")
    try {
      const cp = resolvePostalCodeForPublish({
        codePostal,
        ville,
        findVilleCp: (v) => findVilleByName(v)?.cp,
      })
      if (!cp) throw new Error("Code postal invalide (5 chiffres requis).")
      setCodePostal(cp)

      let seoLocal = seo
      let rapportLocal = rapport
      if (!seoLocal) {
        setInfo("Génération du contenu SEO…")
        const resGen = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcription: texte.trim(),
            type_intervention: typeIntervention,
            ville,
            code_postal: cp,
            technicien_nom: formatTechnicienNom(technicienNom),
          }),
          signal: AbortSignal.timeout(180_000),
        })
        const dataGen = await resGen.json()
        if (!resGen.ok) throw new Error(dataGen.error || "Génération échouée")
        seoLocal = dataGen.seo
        rapportLocal = dataGen.rapport
        setSeo(seoLocal)
        setRapport(rapportLocal)
      }

      const tech = formatTechnicienNom(technicienNom) || "Mondor"
      const photos = [
        { dataUrl: avant.dataUrl, legende: "Avant intervention", file: avant.file },
        ...(apres
          ? [{ dataUrl: apres.dataUrl, legende: "Après intervention", file: apres.file }]
          : []),
      ]

      void REALISATION_PAGE_STYLE
      const idSuffix = Date.now().toString(36)
      const baseSlug = `${typeIntervention}-${ville}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70)
      const publishSlug = `${baseSlug}-${idSuffix}`.slice(0, 95)

      // Pas de data:image dans content/jsonld : Django reçoit les fichiers
      // before/after et refuse souvent un body trop gros (HTTP 400 vide).
      const seoPrepared = prepareSeoForPublish({
        seo: seoLocal || {},
        typeIntervention,
        ville,
        codePostal: cp,
        transcription: texte.trim(),
        interventionDate: dateIntervention,
        publishSlug,
        technicienNom: tech,
        photos: [],
      })

      const { content: contentWithContainers, seo: seoForPublish } = buildPublishContentHtml({
        seo: seoPrepared,
        rapport: rapportLocal,
        typeIntervention,
        ville,
        codePostal: cp,
        cityPageUrl: buildCityPageUrl(ville, cp),
        interventionDate: dateIntervention,
        photos: photos.map((p) => ({
          legende: p.legende,
        })),
        technicien: { nom: tech, photoUrl: null, anneesExperience: null, titreMetier: null },
      })

      const rawTitle =
        (typeof seoForPublish.titre_h1 === "string" && seoForPublish.titre_h1)
        || `${typeIntervention} à ${ville}`
      const rawMetaTitle =
        (typeof seoForPublish.meta_title === "string" && seoForPublish.meta_title)
        || rawTitle

      const formData = new FormData()
      formData.append("title", finalizeTitreH1(rawTitle))
      formData.append("meta_title", finalizeMetaTitle(rawMetaTitle))
      formData.append("titre_h1", finalizeTitreH1(rawTitle))
      formData.append("slug", publishSlug)
      formData.append("service_type", typeIntervention)
      formData.append("location", ville)
      formData.append("intervention_city", ville)
      formData.append("postal_code", cp)
      formData.append("intervention_date", dateIntervention)
      formData.append(
        "description",
        finalizeMetaDescription(
          buildPublishDescription({
            seo: seoForPublish,
            rapport: rapportLocal,
            typeIntervention,
            ville,
          }),
          ville,
        ),
      )
      formData.append(
        "meta_keywords",
        Array.isArray(seoForPublish.meta_keywords)
          ? seoForPublish.meta_keywords.join(", ")
          : "",
      )
      formData.append("content", contentWithContainers)
      formData.append(
        "faq_json",
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: (Array.isArray(seoForPublish.faq) ? seoForPublish.faq : []).map(
            (f: { question?: string; reponse?: string }) => ({
              "@type": "Question",
              name: f?.question || "",
              acceptedAnswer: { "@type": "Answer", text: f?.reponse || "" },
            }),
          ),
        }),
      )
      formData.append("jsonld", JSON.stringify(seoForPublish.jsonld || {}))
      formData.append(
        "related_services_json",
        JSON.stringify(seoForPublish.related_services || []),
      )
      formData.append("is_published", "true")
      formData.append("transcription", texte.trim())
      formData.append("rapport_json", JSON.stringify(rapportLocal || {}))
      formData.append("seo_json", JSON.stringify(seoForPublish))
      formData.append("client_nom", "")
      formData.append("client_email", "")
      formData.append("client_adresse", `${cp} ${ville}`.trim())
      formData.append("technicien_name", tech)
      const { renamePhotoFile, buildPhotoLegende, buildPhotoNomBase } = await import(
        "@/lib/photo-seo-name"
      )
      const photoOpts = {
        typeIntervention,
        ville,
        date: dateIntervention,
      }
      const beforeFile = renamePhotoFile(avant.file, { ...photoOpts, role: "avant" })
      const afterFile = renamePhotoFile(apres?.file || avant.file, { ...photoOpts, role: "apres" })
      formData.append("before_image", beforeFile)
      formData.append("after_image", afterFile)
      formData.append("photos_nom_base", buildPhotoNomBase(photoOpts))
      formData.append(
        "photos_json",
        JSON.stringify([
          {
            field: "before_image",
            ordre: 0,
            filename: beforeFile.name,
            legende: buildPhotoLegende({ ...photoOpts, role: "avant" }),
            categorie: "avant",
          },
          {
            field: "after_image",
            ordre: 1,
            filename: afterFile.name,
            legende: buildPhotoLegende({ ...photoOpts, role: "apres" }),
            categorie: "apres",
          },
        ]),
      )

      setInfo("Publication sur le site…")
      const res = await fetch("/api/publish", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      const slug = (data.slug as string) || publishSlug
      setPublishedSlug(slug)
      setInterventionId((data.interventionId as string) || null)
      setPhotoUrl((data.photoUrl as string) || null)
      setSiteDone(true)
      setInfo(`✓ Publié sur le site — /nos-realisations/${slug}`)
    } catch (e) {
      setError(`Publication site : ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function handlePublishGmb() {
    setBusy("gmb")
    setError("")
    setInfo("")
    try {
      const resume =
        (typeof seo?.resume_rich_snippet === "string" && seo.resume_rich_snippet)
        || (typeof seo?.meta_description === "string" && seo.meta_description)
        || undefined

      const res = await fetch("/api/publish-gmb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          interventionId
            ? { interventionId }
            : {
                type: typeIntervention,
                ville,
                summary: resume,
                photoUrl: photoUrl || undefined,
                slug: publishedSlug,
              },
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setGmbDone(true)
      setInfo("✓ Publié sur Google Business")
    } catch (e) {
      setError(`Publication GMB : ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const inputCls =
    "w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-4 py-3 text-base"

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <AppTabs />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <section className="bg-gradient-to-br from-[#0e2a52] to-[#1a3a6b] text-white rounded-2xl p-5 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.25em] text-orange-300/90 font-bold">
            Contenu site · sans fiche client
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">Rapport externe</h1>
          <p className="text-sm text-white/70 mt-1">
            Texte + photos avant/après → publier sur le site et Google Business.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <h2 className="font-bold text-[#0e2a52]">Type d&apos;intervention</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setTypeIntervention(t.v)}
                className={`rounded-xl border-2 px-2 py-3 text-xs font-bold transition ${
                  typeIntervention === t.v
                    ? "border-[#0e2a52] bg-[#0e2a52] text-white"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="block text-lg mb-1">{t.icon}</span>
                {t.v.replace("Débouchage ", "")}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
          <h2 className="font-bold text-[#0e2a52]">Lieu</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-bold">Ville</span>
              <div className="mt-1">
                <VilleCombobox
                  value={ville}
                  onChange={setVille}
                  onSelect={(v) => {
                    setVille(v.nom)
                    setCodePostal(v.cp)
                  }}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-bold">
                Code postal
              </span>
              <input
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                className={`${inputCls} mt-1`}
                placeholder="83000"
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-bold">Date</span>
              <input
                type="date"
                value={dateIntervention}
                onChange={(e) => setDateIntervention(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-bold">
                Technicien
              </span>
              <input
                value={technicienNom}
                onChange={(e) => setTechnicienNom(e.target.value)}
                className={`${inputCls} mt-1`}
                placeholder="Mondor"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
          <h2 className="font-bold text-[#0e2a52]">Texte du chantier</h2>
          <p className="text-sm text-slate-500">
            Décris l&apos;intervention (comme une dictée). Sert à générer le contenu SEO du site.
          </p>
          <textarea
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value)
              setSeo(null)
              setRapport(null)
              setSiteDone(false)
              setGmbDone(false)
            }}
            rows={7}
            className={inputCls}
            placeholder="Ex. Inspection caméra à Les Adrets… regard enterré suspecté à 16 m…"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!!busy || !texte.trim() || !ville.trim()}
            className="w-full min-h-[48px] rounded-xl border-2 border-[#0e2a52] text-[#0e2a52] font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "generate" ? "Génération SEO…" : seo ? "✓ Contenu prêt — regénérer" : "✨ Générer le contenu SEO"}
          </button>
          {seo && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
              <p>
                <span className="font-bold text-slate-500">H1</span>{" "}
                {typeof seo.titre_h1 === "string" ? seo.titre_h1 : "—"}
              </p>
              <p>
                <span className="font-bold text-slate-500">Title</span>{" "}
                {typeof seo.meta_title === "string" ? seo.meta_title : "—"}
              </p>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
          <h2 className="font-bold text-[#0e2a52]">Photos avant / après</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhotoPicker
              label="Avant"
              required
              photo={avant}
              onPick={(f) => loadPhoto(f, setAvant)}
              onClear={() => setAvant(null)}
            />
            <PhotoPicker
              label="Après"
              photo={apres}
              onPick={(f) => loadPhoto(f, setApres)}
              onClear={() => setApres(null)}
            />
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm font-semibold">
            ⚠ {error}
          </div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-sm font-semibold">
            {info}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
          <h2 className="font-bold text-[#0e2a52]">Publication</h2>
          <p className="text-sm text-slate-500">
            Deux actions seulement : site Internet, puis Google Business.
          </p>
          <button
            type="button"
            onClick={handlePublishSite}
            disabled={!!busy || !avant || !texte.trim() || !ville.trim()}
            className="w-full min-h-[52px] bg-[#0e2a52] hover:bg-[#0a2047] disabled:opacity-50 text-white rounded-2xl font-black text-base"
          >
            {busy === "site"
              ? "Publication site…"
              : siteDone
                ? "✓ Republier sur le site"
                : "🌐 Publier sur le site"}
          </button>
          <button
            type="button"
            onClick={handlePublishGmb}
            disabled={!!busy || (!siteDone && !interventionId && !publishedSlug)}
            title={!siteDone ? "Publie d'abord sur le site" : undefined}
            className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-base"
          >
            {busy === "gmb"
              ? "Publication GMB…"
              : gmbDone
                ? "✓ Republier sur GMB"
                : "📍 Publier sur Google Business"}
          </button>
          {publishedSlug && (
            <a
              href={`https://lestechniciensdudebouchage.fr/nos-realisations/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm font-bold text-[#0e2a52] hover:underline"
            >
              Voir la page en ligne →
            </a>
          )}
        </section>
      </main>
    </div>
  )
}

function PhotoPicker({
  label,
  required,
  photo,
  onPick,
  onClear,
}: {
  label: string
  required?: boolean
  photo: PhotoSlot | null
  onPick: (f: File | null) => void
  onClear: () => void
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 p-3 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
        {required ? " *" : ""}
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview blob locale
        <img
          src={photo.preview}
          alt={label}
          className="w-full h-40 object-cover rounded-lg"
        />
      ) : (
        <div className="h-40 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
          Aucune photo
        </div>
      )}
      <div className="flex gap-2">
        <label className="flex-1 text-center bg-slate-800 text-white text-xs font-bold rounded-lg py-2.5 cursor-pointer">
          Choisir
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </label>
        {photo && (
          <button
            type="button"
            onClick={onClear}
            className="px-3 text-xs font-bold text-red-600 border border-red-200 rounded-lg"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
