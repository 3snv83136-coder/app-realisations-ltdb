'use client'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { backgroundColor: '#1a3a6b', color: 'white', padding: 20, marginBottom: 20, borderRadius: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  headerSub: { fontSize: 9, color: '#a0c0ff', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#1a3a6b', borderBottom: '1pt solid #1a3a6b', paddingBottom: 4, marginBottom: 8 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, fontWeight: 'bold', color: '#555' },
  value: { flex: 1 },
  infoBox: { backgroundColor: '#f0f4ff', border: '1pt solid #c0d0ff', padding: 10, borderRadius: 4, marginBottom: 8 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1pt solid #ddd', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#888' },
})

interface PDFProps {
  clientNom: string
  adresse: string
  ville: string
  codePostal: string
  dateIntervention: string
  typeIntervention: string
  technicienNom: string
  rapport: {
    diagnostic: string
    travaux_realises: string
    recommandations: string
    commentaire_technicien: string
  }
  phone?: string
}

function RealisationDocument({ clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention, technicienNom, rapport, phone = '07 83 63 68 35' }: PDFProps) {
  return (
    <Document>
      {/* Page 1 — En-tête + infos client */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Les Techniciens du Débouchage</Text>
          <Text style={styles.headerSub}>Rapport d'intervention — {typeIntervention}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations client</Text>
          <View style={styles.row}><Text style={styles.label}>Client :</Text><Text style={styles.value}>{clientNom}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Adresse :</Text><Text style={styles.value}>{adresse}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Ville :</Text><Text style={styles.value}>{ville} ({codePostal})</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date :</Text><Text style={styles.value}>{dateIntervention}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Technicien :</Text><Text style={styles.value}>{technicienNom}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Type :</Text><Text style={styles.value}>{typeIntervention}</Text></View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Les Techniciens du Débouchage · {phone}</Text>
          <Text style={styles.footerText}>lestechniciensdudebouchage.fr</Text>
        </View>
      </Page>

      {/* Page 2 — Rapport technique */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rapport technique</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostic</Text>
          <View style={styles.infoBox}><Text>{rapport.diagnostic}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travaux réalisés</Text>
          <View style={styles.infoBox}><Text>{rapport.travaux_realises}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommandations</Text>
          <View style={styles.infoBox}><Text>{rapport.recommandations}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note technicien</Text>
          <View style={styles.infoBox}><Text>{rapport.commentaire_technicien}</Text></View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Les Techniciens du Débouchage · {phone}</Text>
          <Text style={styles.footerText}>Document confidentiel — Usage client uniquement</Text>
        </View>
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends PDFProps {
  filename?: string
}

export default function PDFDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `rapport-${props.ville.toLowerCase()}-${props.dateIntervention}.pdf`
  return (
    <PDFDownloadLink document={<RealisationDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? 'Génération PDF...' : '⬇ Télécharger PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
