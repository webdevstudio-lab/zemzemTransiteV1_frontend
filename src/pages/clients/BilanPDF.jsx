import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

/* ─────────────────────────────────────────────
   UTILITAIRES
───────────────────────────────────────────── */

/**
 * Formate un nombre avec séparateurs de milliers (espace insécable)
 * ex: 1000000 → "1 000 000"
 */
const fmt = (n) => {
  if (n === null || n === undefined || n === "-") return "-";
  const num = Number(n);
  if (isNaN(num)) return "-";
  return num.toLocaleString("fr-FR"); // ex: 1 000 000
};

/**
 * Nettoie la description :
 * - Supprime le préfixe "Facturation BL: XXXXX | Montant: XXXXXX"  → garde le reste
 * - Supprime aussi "Facturation BL: XXXXX |" sans montant
 * - Si la description ne contient que ça, on retourne la désignation nettoyée
 */
const cleanDescription = (raw = "") => {
  // Supprime "Facturation BL: [ref] | Montant: [n]" et variantes
  let cleaned = raw
    .replace(/Facturation\s+BL\s*:\s*[^\|]+\|\s*Montant\s*:\s*[\d\s]+/gi, "")
    .replace(/Facturation\s+BL\s*:\s*[^\|]+\|?/gi, "")
    .replace(/\|\s*Montant\s*:\s*[\d\s]+/gi, "")
    .trim();

  // Si tout a été effacé, on retourne "Facturation" comme libellé minimal
  return cleaned || "Facturation";
};

/* ─────────────────────────────────────────────
   COULEURS & STYLES
───────────────────────────────────────────── */
const COLORS = {
  PRIMARY_RED: "#EF233C",
  DARK_BLUE: "#2B2D42",
  SLATE_BLUE: "#8D99AE",
  LIGHT_BG: "#F8F9FA",
  BORDER: "#EDF2F4",
  ROW_ALT: "#FAFBFC",
  WHITE: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.DARK_BLUE,
  },

  /* ── HEADER ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY_RED,
    paddingBottom: 14,
  },
  logo: { width: 110 },
  titleContainer: { textAlign: "right" },
  mainTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: COLORS.DARK_BLUE,
  },
  periodText: { fontSize: 8, marginTop: 4, color: COLORS.SLATE_BLUE },

  /* ── CLIENT BOX ── */
  infoSection: { marginBottom: 18 },
  clientBox: {
    padding: 10,
    backgroundColor: COLORS.LIGHT_BG,
    width: "46%",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.DARK_BLUE,
  },
  clientLabel: { fontSize: 7, color: COLORS.SLATE_BLUE, marginBottom: 3 },
  clientName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  clientSub: { fontSize: 8, color: COLORS.SLATE_BLUE, marginTop: 2 },

  /* ── TABLE ── */
  table: { marginTop: 8 },

  // En-tête du tableau
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.DARK_BLUE,
    color: COLORS.WHITE,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  thText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLORS.WHITE,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Lignes du tableau
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRowAlt: { backgroundColor: COLORS.ROW_ALT },
  tableRowReport: { backgroundColor: "#F0F4FF" },

  // Colonnes — largeurs ajustées pour 7 colonnes
  colDate: { width: "10%" },
  colDesc: { width: "26%" },
  colNbrCont: { width: "7%", textAlign: "center" },
  colNumCont: { width: "15%" },
  colMarch: { width: "18%" },
  colDebit: { width: "12%", textAlign: "right" },
  colCredit: { width: "12%", textAlign: "right" },

  // Textes cellules
  cellText: { fontSize: 8, color: COLORS.DARK_BLUE },
  cellTextBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.DARK_BLUE,
  },
  cellDebit: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#C0392B" },
  cellCredit: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#27AE60" },
  cellMuted: { fontSize: 8, color: COLORS.SLATE_BLUE },
  cellReportBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#2563EB",
  },

  /* ── SUMMARY ── */
  summarySection: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  summaryBox: {
    width: "42%",
    backgroundColor: COLORS.DARK_BLUE,
    padding: 10,
    color: COLORS.WHITE,
    borderRadius: 4,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: { fontSize: 8, color: "#CBD5E1" },
  summaryValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.WHITE,
  },
  finalBalance: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.3)",
    marginTop: 6,
    paddingTop: 6,
  },
  finalLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.WHITE,
  },
  finalValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FCD34D" },

  /* ── FOOTER ── */
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingTop: 8,
    fontSize: 7,
    color: COLORS.SLATE_BLUE,
  },
});

/* ─────────────────────────────────────────────
   COMPOSANT PRINCIPAL
   Props :
     data      — tableau de transactions filtrées
     client    — objet client
     period    — { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
     bilanSummary — { initial, debit, credit, final }
     blsMap    — Map<numBl, { numDeConteneur, nbrDeConteneur, contenance }>
───────────────────────────────────────────── */
const BilanPDF = ({ data = [], client, period, bilanSummary, blsMap = {} }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Image src="/assets/logo.png" style={styles.logo} />
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>Extrait de Compte / Bilan</Text>
          <Text style={styles.periodText}>
            Période : {period?.start} au {period?.end}
          </Text>
        </View>
      </View>

      {/* ── INFO CLIENT ── */}
      <View style={styles.infoSection}>
        <View style={styles.clientBox}>
          <Text style={styles.clientLabel}>CLIENT</Text>
          <Text style={styles.clientName}>{client?.nom?.toUpperCase()}</Text>
          <Text style={styles.clientSub}>
            {client?.telephone || client?.contact || "—"}
          </Text>
        </View>
      </View>

      {/* ── TABLEAU ── */}
      <View style={styles.table}>
        {/* En-tête */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.colDate]}>Date</Text>
          <Text style={[styles.thText, styles.colDesc]}>Désignation</Text>
          <Text style={[styles.thText, styles.colNbrCont]}>Nb Cont</Text>
          <Text style={[styles.thText, styles.colNumCont]}>N° Conteneur</Text>
          <Text style={[styles.thText, styles.colMarch]}>Marchandise</Text>
          <Text style={[styles.thText, styles.colDebit]}>Débit (-)</Text>
          <Text style={[styles.thText, styles.colCredit]}>Crédit (+)</Text>
        </View>

        {/* Ligne Report solde antérieur */}
        <View style={[styles.tableRow, styles.tableRowReport]}>
          <Text style={[styles.cellMuted, styles.colDate]}>---</Text>
          <Text style={[styles.cellReportBold, styles.colDesc]}>
            REPORT SOLDE ANTÉRIEUR
          </Text>
          <Text style={[styles.cellMuted, styles.colNbrCont]}>—</Text>
          <Text style={[styles.cellMuted, styles.colNumCont]}>—</Text>
          <Text style={[styles.cellMuted, styles.colMarch]}>—</Text>
          <Text style={[styles.cellReportBold, styles.colDebit]}>
            {fmt(bilanSummary?.initial)}
          </Text>
          <Text style={[styles.cellMuted, styles.colCredit]}>-</Text>
        </View>

        {/* Lignes transactions */}
        {data.map((t, i) => {
          const isCredit = t.typeOperation?.toLowerCase().includes("credit");

          // Récupération des infos BL depuis blsMap
          // On cherche le numBl dans la description (format "... BL: XXXXX |...")
          // OU directement via t.numBl si le champ existe
          let blInfo = null;
          if (t.numBl && blsMap[t.numBl]) {
            blInfo = blsMap[t.numBl];
          } else {
            // Extraction du numBl depuis la description
            const match = t.description?.match(/BL\s*:\s*([^\s|,]+)/i);
            if (match && blsMap[match[1]]) {
              blInfo = blsMap[match[1]];
            }
          }

          const nbrCont = blInfo?.nbrDeConteneur ?? "—";
          const numCont = blInfo?.numDeConteneur ?? "—";
          const marchand = blInfo?.contenance ?? "—";

          return (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 0 ? {} : styles.tableRowAlt]}
            >
              <Text style={[styles.cellText, styles.colDate]}>
                {new Date(t.date).toLocaleDateString("fr-FR")}
              </Text>
              <Text style={[styles.cellText, styles.colDesc]}>
                {cleanDescription(t.description)}
              </Text>
              <Text style={[styles.cellText, styles.colNbrCont]}>
                {nbrCont}
              </Text>
              <Text style={[styles.cellText, styles.colNumCont]}>
                {numCont}
              </Text>
              <Text style={[styles.cellText, styles.colMarch]}>{marchand}</Text>
              <Text
                style={[
                  isCredit ? styles.cellMuted : styles.cellDebit,
                  styles.colDebit,
                ]}
              >
                {!isCredit ? fmt(t.montant) : "-"}
              </Text>
              <Text
                style={[
                  isCredit ? styles.cellCredit : styles.cellMuted,
                  styles.colCredit,
                ]}
              >
                {isCredit ? fmt(t.montant) : "-"}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── RÉSUMÉ ── */}
      <View style={styles.summarySection}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Total Débit :</Text>
            <Text style={styles.summaryValue}>{fmt(bilanSummary?.debit)}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Total Crédit :</Text>
            <Text style={styles.summaryValue}>{fmt(bilanSummary?.credit)}</Text>
          </View>
          <View style={[styles.summaryLine, styles.finalBalance]}>
            <Text style={styles.finalLabel}>SOLDE FINAL :</Text>
            <Text style={styles.finalValue}>{fmt(bilanSummary?.final)}</Text>
          </View>
        </View>
      </View>

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Text>
          ZEMZEM GROUP — Tevragh Zeina Ilot 1, Nouakchott — Tél : +222 22 32 32
          53
        </Text>
      </View>
    </Page>
  </Document>
);

export default BilanPDF;
