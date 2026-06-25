'use client'

import type { ReactNode } from 'react'
import type { Salarie } from "@/lib/rh/types"

export type SalarieFormValues = {
  nom: string
  prenom: string
  adresse: string
  code_postal: string
  ville: string
  email: string
  telephone: string
  date_naissance: string
  lieu_naissance: string
  nationalite: string
  numero_secu: string
  poste: string
  qualification: string
  coefficient: string
  salaire_brut_mensuel: string
  temps_travail: string
  date_embauche: string
  date_fin_contrat: string
  type_contrat: string
  motif_cdd: string
  periode_essai_mois: string
  mutuelle: string
  permis_numero: string
  permis_delivrance: string
  permis_categories: string
  notes: string
  actif: boolean
}

export function emptySalarieForm(): SalarieFormValues {
  return {
    nom: '',
    prenom: '',
    adresse: '',
    code_postal: '',
    ville: '',
    email: '',
    telephone: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: 'Française',
    numero_secu: '',
    poste: '',
    qualification: '',
    coefficient: '',
    salaire_brut_mensuel: '',
    temps_travail: '35 heures par semaine',
    date_embauche: '',
    date_fin_contrat: '',
    type_contrat: 'CDI',
    motif_cdd: '',
    periode_essai_mois: '2',
    mutuelle: '',
    permis_numero: '',
    permis_delivrance: '',
    permis_categories: '',
    notes: '',
    actif: true,
  }
}

export function salarieToForm(s: Salarie): SalarieFormValues {
  return {
    nom: s.nom || '',
    prenom: s.prenom || '',
    adresse: s.adresse || '',
    code_postal: s.code_postal || '',
    ville: s.ville || '',
    email: s.email || '',
    telephone: s.telephone || '',
    date_naissance: s.date_naissance || '',
    lieu_naissance: s.lieu_naissance || '',
    nationalite: s.nationalite || 'Française',
    numero_secu: s.numero_secu || '',
    poste: s.poste || '',
    qualification: s.qualification || '',
    coefficient: s.coefficient != null ? String(s.coefficient) : '',
    salaire_brut_mensuel: s.salaire_brut_mensuel != null ? String(s.salaire_brut_mensuel) : '',
    temps_travail: s.temps_travail || '35 heures par semaine',
    date_embauche: s.date_embauche || '',
    date_fin_contrat: s.date_fin_contrat || '',
    type_contrat: s.type_contrat || 'CDI',
    motif_cdd: s.motif_cdd || '',
    periode_essai_mois: s.periode_essai_mois != null ? String(s.periode_essai_mois) : '2',
    mutuelle: s.mutuelle || '',
    permis_numero: s.permis_numero || '',
    permis_delivrance: s.permis_delivrance || '',
    permis_categories: s.permis_categories || '',
    notes: s.notes || '',
    actif: s.actif !== false,
  }
}

export function formToPayload(f: SalarieFormValues) {
  return {
    ...f,
    coefficient: f.coefficient ? Number(f.coefficient) : null,
    salaire_brut_mensuel: f.salaire_brut_mensuel ? Number(f.salaire_brut_mensuel) : null,
    periode_essai_mois: f.periode_essai_mois ? Number(f.periode_essai_mois) : 2,
  }
}

type Props = {
  values: SalarieFormValues
  onChange: (patch: Partial<SalarieFormValues>) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputCls = 'w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm'

export default function SalarieForm({ values, onChange }: Props) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Prénom *">
          <input className={inputCls} value={values.prenom} onChange={e => onChange({ prenom: e.target.value })} />
        </Field>
        <Field label="Nom *">
          <input className={inputCls} value={values.nom} onChange={e => onChange({ nom: e.target.value })} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={values.email} onChange={e => onChange({ email: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <input type="tel" className={inputCls} value={values.telephone} onChange={e => onChange({ telephone: e.target.value })} />
        </Field>
        <Field label="Adresse">
          <input className={inputCls} value={values.adresse} onChange={e => onChange({ adresse: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CP">
            <input className={inputCls} value={values.code_postal} onChange={e => onChange({ code_postal: e.target.value })} />
          </Field>
          <Field label="Ville">
            <input className={inputCls} value={values.ville} onChange={e => onChange({ ville: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <h3 className="sm:col-span-2 font-bold text-[#0e2a52]">État civil</h3>
        <Field label="Date de naissance">
          <input type="date" className={inputCls} value={values.date_naissance} onChange={e => onChange({ date_naissance: e.target.value })} />
        </Field>
        <Field label="Lieu de naissance">
          <input className={inputCls} value={values.lieu_naissance} onChange={e => onChange({ lieu_naissance: e.target.value })} />
        </Field>
        <Field label="Nationalité">
          <input className={inputCls} value={values.nationalite} onChange={e => onChange({ nationalite: e.target.value })} />
        </Field>
        <Field label="N° sécurité sociale">
          <input className={inputCls} value={values.numero_secu} onChange={e => onChange({ numero_secu: e.target.value })} />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <h3 className="sm:col-span-2 font-bold text-[#0e2a52]">Contrat</h3>
        <Field label="Poste">
          <input className={inputCls} value={values.poste} onChange={e => onChange({ poste: e.target.value })} placeholder="Technicien débouchage" />
        </Field>
        <Field label="Qualification">
          <input className={inputCls} value={values.qualification} onChange={e => onChange({ qualification: e.target.value })} />
        </Field>
        <Field label="Type de contrat">
          <select className={inputCls} value={values.type_contrat} onChange={e => onChange({ type_contrat: e.target.value })}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
          </select>
        </Field>
        <Field label="Date d'embauche">
          <input type="date" className={inputCls} value={values.date_embauche} onChange={e => onChange({ date_embauche: e.target.value })} />
        </Field>
        {values.type_contrat === 'CDD' && (
          <>
            <Field label="Date fin CDD">
              <input type="date" className={inputCls} value={values.date_fin_contrat} onChange={e => onChange({ date_fin_contrat: e.target.value })} />
            </Field>
            <Field label="Motif CDD">
              <input className={inputCls} value={values.motif_cdd} onChange={e => onChange({ motif_cdd: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Salaire brut mensuel (€)">
          <input type="number" step="0.01" className={inputCls} value={values.salaire_brut_mensuel} onChange={e => onChange({ salaire_brut_mensuel: e.target.value })} />
        </Field>
        <Field label="Temps de travail">
          <input className={inputCls} value={values.temps_travail} onChange={e => onChange({ temps_travail: e.target.value })} />
        </Field>
        <Field label="Coefficient">
          <input type="number" step="0.01" className={inputCls} value={values.coefficient} onChange={e => onChange({ coefficient: e.target.value })} />
        </Field>
        <Field label="Période d'essai (mois)">
          <input type="number" min="0" className={inputCls} value={values.periode_essai_mois} onChange={e => onChange({ periode_essai_mois: e.target.value })} />
        </Field>
        <Field label="Mutuelle">
          <input className={inputCls} value={values.mutuelle} onChange={e => onChange({ mutuelle: e.target.value })} />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <h3 className="sm:col-span-2 font-bold text-[#0e2a52]">Permis de conduire</h3>
        <Field label="N° permis">
          <input className={inputCls} value={values.permis_numero} onChange={e => onChange({ permis_numero: e.target.value })} />
        </Field>
        <Field label="Date de délivrance">
          <input type="date" className={inputCls} value={values.permis_delivrance} onChange={e => onChange({ permis_delivrance: e.target.value })} />
        </Field>
        <Field label="Catégories">
          <input className={inputCls} value={values.permis_categories} onChange={e => onChange({ permis_categories: e.target.value })} placeholder="B" />
        </Field>
      </section>

      <Field label="Notes internes">
        <textarea className={`${inputCls} min-h-[80px]`} value={values.notes} onChange={e => onChange({ notes: e.target.value })} />
      </Field>

      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={values.actif} onChange={e => onChange({ actif: e.target.checked })} />
        Salarié actif
      </label>
    </div>
  )
}
