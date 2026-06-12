'use client'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { TravauxSupplementairesRecord } from '@/lib/travaux-supplementaires'
import { fmtEUR } from '@/lib/format'

const C = {
  navy: '#0e2a52',
  border: '#d9dfe7',
  text: '#1e293b',
  muted: '#6b7280',
  soft: '#f2f6fb',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, padding: 40, lineHeight: 1.45 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 9, color: C.muted, marginBottom: 16 },
  section: { marginBottom: 12 },
  label: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', marginBottom: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, fontFamily: 'Helvetica-Bold' },
  box: { backgroundColor: C.soft, padding: 10, borderRadius: 4, marginTop: 8 },
  signature: { width: 180, height: 70, marginTop: 6, objectFit: 'contain' },
  legal: { fontSize: 7.5, color: C.muted, marginTop: 16 },
})

type Props = {
  record: TravauxSupplementairesRecord
  interventionRef?: string | null
  adresse?: string | null
  ville?: string | null
}

export function TravauxSupplementairesDocument({ record, interventionRef, adresse, ville }: Props) {
  const dateSigne = record.signed_at
    ? new Date(record.signed_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    : '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Accord — Travaux supplémentaires</Text>
        <Text style={s.subtitle}>
          Les Techniciens du Débouchage
          {interventionRef ? ` · Intervention ${interventionRef}` : ''}
        </Text>

        <View style={s.section}>
          <Text style={s.label}>Client</Text>
          <Text>{record.client_nom}</Text>
          {(adresse || ville) && (
            <Text style={{ color: C.muted, marginTop: 2 }}>
              {[adresse, ville].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.label}>Prestations acceptées</Text>
          {record.lignes.map((l, i) => (
            <View key={i} style={s.line}>
              <Text>{l.label}{l.quantite > 1 ? ` × ${l.quantite}` : ''}</Text>
              <Text>{fmtEUR((l.quantite || 1) * (l.prix_ht || 0))} HT</Text>
            </View>
          ))}
          {record.prestation_manuelle?.trim() && (
            <View style={s.box}>
              <Text style={s.label}>Précision manuelle</Text>
              <Text>{record.prestation_manuelle.trim()}</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <View style={s.totalRow}>
            <Text>Total HT</Text>
            <Text>{fmtEUR(record.total_ht)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>TVA ({record.taux_tva}%)</Text>
            <Text>{fmtEUR(record.total_ttc - record.total_ht)}</Text>
          </View>
          <View style={[s.totalRow, { fontSize: 11, marginTop: 4 }]}>
            <Text>Total TTC</Text>
            <Text>{fmtEUR(record.total_ttc)}</Text>
          </View>
        </View>

        {record.photo_url && (
          <View style={s.section}>
            <Text style={s.label}>Photo après travaux supplémentaires</Text>
            <Image src={record.photo_url} style={{ width: 200, height: 140, objectFit: 'cover', marginTop: 4 }} />
          </View>
        )}

        <View style={s.section}>
          <Text style={s.label}>Signature client</Text>
          <Text>Signé le {dateSigne}</Text>
          {record.signature_url && (
            <Image src={record.signature_url} style={s.signature} />
          )}
        </View>

        <Text style={s.legal}>
          Le client a demandé expressément la réalisation de ces travaux supplémentaires et renonce à son droit
          de rétractation pour ces prestations réalisées en urgence sur place.
        </Text>
      </Page>
    </Document>
  )
}
