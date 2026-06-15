import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Network, SimulationResults } from '../types/network';
import { flowUnitLabel } from '../utils/format';
import { collectViolations } from '../utils/compliance';

const BRAND = '#1d4ed8';

interface ReportInput {
  network: Network;
  results: SimulationResults;
  timeIndex: number;
  times: number[];
  mapImage?: string; // dataURL PNG
  profileImage?: string; // dataURL PNG du profil en long
}

function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function statName(min: number, max: number, val: number): string {
  return `${val.toFixed(2)} (${min.toFixed(1)}–${max.toFixed(1)})`;
}

/** Génère et télécharge un rapport PDF de la simulation. */
export function generateReport(input: ReportInput): void {
  const { network, results, timeIndex, times, mapImage, profileImage } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const flowU = flowUnitLabel(results.flowUnits);
  const lenU = results.lengthUnit;
  const presU = results.pressureUnit;

  // --- En-tête ---
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Rapport de simulation hydraulique', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(network.meta.name || 'Réseau', margin, 20);

  let y = 36;
  doc.setTextColor('#111827');
  doc.setFontSize(10);
  const dateStr = new Date(results.ranAt).toLocaleString('fr-FR');
  const lines = [
    `Auteur : ${network.meta.author || '—'}`,
    `Date du calcul : ${dateStr}`,
    `Instant analysé : ${clock(times[timeIndex] ?? 0)}`,
    `Formule de perte de charge : ${network.options.headlossFormula}`,
    `Unité de débit : ${flowU}`,
  ];
  lines.forEach((l) => {
    doc.text(l, margin, y);
    y += 5.5;
  });
  if (network.meta.description) {
    y += 1;
    doc.setFont('helvetica', 'italic');
    const wrapped = doc.splitTextToSize(network.meta.description, pageW - 2 * margin);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
    doc.setFont('helvetica', 'normal');
  }

  // --- Synthèse réseau ---
  const nodes = Object.values(network.nodes);
  const links = Object.values(network.links);
  const nJun = nodes.filter((n) => n.type === 'junction').length;
  const nRes = nodes.filter((n) => n.type === 'reservoir').length;
  const nTank = nodes.filter((n) => n.type === 'tank').length;
  const nPipe = links.filter((l) => l.type === 'pipe').length;
  const nPump = links.filter((l) => l.type === 'pump').length;
  const nValve = links.filter((l) => l.type === 'valve').length;

  y += 3;
  sectionTitle(doc, 'Synthèse du réseau', margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    head: [['Élément', 'Nombre', 'Élément', 'Nombre']],
    body: [
      ['Nœuds de demande', String(nJun), 'Conduites', String(nPipe)],
      ['Réservoirs/Sources', String(nRes), 'Pompes', String(nPump)],
      ['Châteaux d’eau', String(nTank), 'Vannes', String(nValve)],
    ],
    styles: { fontSize: 9 },
  });
  // @ts-expect-error lastAutoTable ajouté par le plugin
  y = doc.lastAutoTable.finalY + 8;

  // --- Conformité ---
  const compliance = collectViolations(network, results);
  const cr = network.criteria;
  sectionTitle(doc, 'Bilan de conformité', margin, y);
  y += 4;
  doc.setFontSize(9);
  doc.setTextColor('#374151');
  doc.text(
    `Critères : pression ${cr.minPressure}–${cr.maxPressure} ${presU} · vitesse max ${cr.maxVelocity} ${lenU}/s`,
    margin,
    y,
  );
  y += 6;
  if (compliance.violations.length === 0) {
    doc.setFillColor('#dcfce7');
    doc.rect(margin, y - 4, pageW - 2 * margin, 9, 'F');
    doc.setTextColor('#15803d');
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Conforme : ${compliance.nodesChecked} nœud(s) et ${compliance.linksChecked} conduite(s) respectent les critères.`,
      margin + 2,
      y + 2,
    );
    doc.setFont('helvetica', 'normal');
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: '#b91c1c' },
      head: [['Élément', 'Type', 'Critère', 'Valeur', 'Seuil', 'Instant']],
      body: compliance.violations.map((v) => [
        v.id,
        v.type,
        `${v.metric} ${v.kind === 'low' ? 'insuffisante' : 'excessive'}`,
        v.value.toFixed(2),
        `${v.kind === 'low' ? '≥ ' : '≤ '}${v.threshold}`,
        clock(v.time),
      ]),
      styles: { fontSize: 8 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = '#b91c1c';
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // @ts-expect-error plugin
    y = doc.lastAutoTable.finalY + 8;
  }

  // --- Profil en long ---
  if (profileImage) {
    if (y > 215) {
      doc.addPage();
      y = 20;
    }
    sectionTitle(doc, 'Profil en long', margin, y);
    y += 4;
    const pw = pageW - 2 * margin;
    const ph = pw * 0.32;
    try {
      doc.addImage(profileImage, 'PNG', margin, y, pw, ph, undefined, 'FAST');
      y += ph + 8;
    } catch {
      /* ignoré */
    }
  }

  // --- Carte du réseau ---
  if (mapImage) {
    sectionTitle(doc, 'Plan du réseau', margin, y);
    y += 4;
    const imgW = pageW - 2 * margin;
    const imgH = imgW * 0.5;
    try {
      doc.addImage(mapImage, 'PNG', margin, y, imgW, imgH, undefined, 'FAST');
      y += imgH + 8;
    } catch {
      /* image ignorée si invalide */
    }
  }

  // --- Tableau des nœuds (statistiques sur la durée) ---
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  sectionTitle(doc, `Résultats aux nœuds — instant ${clock(times[timeIndex] ?? 0)}`, margin, y);
  y += 3;
  const nodeBody = nodes.map((nd) => {
    const r = results.nodes[nd.id];
    const pres = r?.pressure ?? [];
    const dem = r?.demand ?? [];
    const head = r?.head ?? [];
    const elev = nd.type === 'reservoir' ? '—' : (nd as { elevation?: number }).elevation?.toFixed(1) ?? '—';
    return [
      nd.id,
      nodeTypeLabel(nd.type),
      elev,
      fmtAt(dem, timeIndex),
      fmtAt(head, timeIndex),
      fmtAt(pres, timeIndex),
      pres.length ? statName(Math.min(...pres), Math.max(...pres), pres[timeIndex] ?? 0).split(' ')[1] ?? '' : '',
    ];
  });
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    head: [['ID', 'Type', `Cote (${lenU})`, `Demande (${flowU})`, `Charge (${lenU})`, `Pression (${presU})`, 'Min–Max P.']],
    body: nodeBody,
    styles: { fontSize: 8 },
  });
  // @ts-expect-error plugin
  y = doc.lastAutoTable.finalY + 8;

  // --- Tableau des liens ---
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  sectionTitle(doc, `Résultats aux conduites — instant ${clock(times[timeIndex] ?? 0)}`, margin, y);
  y += 3;
  const linkBody = links.map((lk) => {
    const r = results.links[lk.id];
    const flow = r?.flow ?? [];
    const vel = r?.velocity ?? [];
    const hl = r?.headloss ?? [];
    const diam = lk.type === 'pump' ? '—' : (lk as { diameter?: number }).diameter?.toFixed(1) ?? '—';
    const len = lk.type === 'pipe' ? lk.length.toFixed(0) : '—';
    const tube =
      lk.type === 'pipe' && lk.dn ? `DN${lk.dn}${lk.pn ? ` PN${lk.pn}` : ''}` : '—';
    return [
      lk.id,
      linkTypeLabel(lk.type),
      tube,
      len,
      diam,
      fmtAt(flow, timeIndex),
      fmtAt(vel, timeIndex),
      fmtAt(hl, timeIndex),
    ];
  });
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    head: [['ID', 'Type', 'Tube', `Long. (${lenU})`, 'Ø int. (mm)', `Débit (${flowU})`, `Vitesse (${lenU}/s)`, `Perte (${lenU})`]],
    body: linkBody,
    styles: { fontSize: 8 },
  });
  // @ts-expect-error plugin
  y = doc.lastAutoTable.finalY + 8;

  // --- Avertissements ---
  if (results.warnings.length) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    sectionTitle(doc, 'Avertissements', margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor('#b45309');
    results.warnings.forEach((w) => {
      const wrapped = doc.splitTextToSize(`• ${w}`, pageW - 2 * margin);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.5;
    });
  }

  // --- Pied de page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#9ca3af');
    doc.text(
      `HydroNet — Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Page ${i} / ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  const safeName = (network.meta.name || 'reseau').replace(/[^\w\-]+/g, '_');
  doc.save(`rapport_${safeName}.pdf`);
}

function fmtAt(series: number[], i: number): string {
  const v = series[i];
  return v == null || !isFinite(v) ? '—' : v.toFixed(2);
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BRAND);
  doc.text(text, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111827');
}

function nodeTypeLabel(t: string): string {
  return t === 'junction' ? 'Nœud' : t === 'reservoir' ? 'Réservoir' : 'Château';
}
function linkTypeLabel(t: string): string {
  return t === 'pipe' ? 'Conduite' : t === 'pump' ? 'Pompe' : 'Vanne';
}
