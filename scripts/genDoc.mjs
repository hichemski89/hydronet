// Génère le manuel d'utilisation PDF de HydroNet (texte + illustrations vectorielles).
// Usage : node scripts/genDoc.mjs
import { jsPDF } from 'jspdf';
import { readFileSync, writeFileSync } from 'fs';

const BRAND = [29, 78, 216];
const DARK = [15, 23, 42];
const MUTED = [100, 116, 139];
const GREEN = [22, 163, 74];
const ORANGE = [217, 119, 6];
const RED = [220, 38, 38];
const TEAL = [13, 148, 136];
const GREY = [148, 163, 184];

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const W = 210;
const H = 297;
const M = 20; // marge
const CW = W - 2 * M; // largeur de contenu
let y = M;

const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);
const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
const draw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

function footer() {
  doc.setFontSize(8);
  setColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('HydroNet — Manuel d’utilisation', M, H - 10);
  doc.text('© 2026 NovaSoft', W - M, H - 10, { align: 'right' });
}

function newPage() {
  footer();
  doc.addPage();
  y = M;
}

function ensure(mm) {
  if (y + mm > H - 18) newPage();
}

function h1(t) {
  ensure(18);
  y += 2;
  fill(BRAND);
  doc.rect(M, y, 3, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(BRAND);
  doc.text(t, M + 6, y + 5.6);
  y += 12;
}

function h2(t) {
  ensure(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(DARK);
  doc.text(t, M, y + 4);
  y += 9;
}

function para(t) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setColor(DARK);
  const lines = doc.splitTextToSize(t, CW);
  for (const ln of lines) {
    ensure(6);
    doc.text(ln, M, y + 4);
    y += 5.4;
  }
  y += 1.5;
}

function bullet(t) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(t, CW - 6);
  ensure(lines.length * 5.4 + 1);
  fill(BRAND);
  doc.circle(M + 1.4, y + 2.4, 0.9, 'F');
  setColor(DARK);
  lines.forEach((ln, i) => {
    doc.text(ln, M + 6, y + 4);
    y += 5.4;
    if (i < lines.length - 1) ensure(5.4);
  });
  y += 0.6;
}

function caption(t) {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text(t, M, y + 3);
  y += 6;
}

// ---------- Illustrations vectorielles ----------
function illusInterface(x, y0, w, h) {
  draw(GREY);
  fill([248, 250, 252]);
  doc.setLineWidth(0.2);
  doc.rect(x, y0, w, h, 'FD');
  // toolbar
  fill([255, 255, 255]);
  doc.rect(x, y0, w, 7, 'FD');
  fill(BRAND);
  doc.roundedRect(x + 2, y0 + 1.6, 3.6, 3.6, 0.6, 0.6, 'F');
  doc.setFontSize(7);
  setColor(DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('HydroNet', x + 7, y0 + 4.4);
  fill([226, 232, 240]);
  for (let i = 0; i < 6; i++) doc.roundedRect(x + 26 + i * 11, y0 + 1.8, 9, 3.2, 0.5, 0.5, 'F');
  // palette gauche
  fill([255, 255, 255]);
  doc.rect(x, y0 + 7, 8, h - 7, 'FD');
  fill([226, 232, 240]);
  for (let i = 0; i < 7; i++) doc.roundedRect(x + 2, y0 + 10 + i * 5, 4, 4, 0.6, 0.6, 'F');
  // panneau droit
  fill([255, 255, 255]);
  doc.rect(x + w - 30, y0 + 7, 30, h - 7, 'FD');
  fill([226, 232, 240]);
  for (let i = 0; i < 5; i++) doc.rect(x + w - 27, y0 + 12 + i * 7, 24, 3.5, 'F');
  // mini réseau au centre
  const cx = x + 8 + (w - 38) / 2;
  const cy = y0 + 7 + (h - 7) / 2;
  draw(BRAND);
  doc.setLineWidth(0.5);
  doc.line(cx - 18, cy - 6, cx + 2, cy - 6);
  doc.line(cx + 2, cy - 6, cx + 2, cy + 8);
  doc.line(cx + 2, cy + 8, cx - 14, cy + 8);
  fill(TEAL);
  doc.rect(cx - 22, cy - 8, 4, 4, 'F');
  fill(GREEN);
  [[cx + 2, cy - 6], [cx + 2, cy + 8], [cx - 14, cy + 8]].forEach((p) => doc.circle(p[0], p[1], 1.4, 'F'));
  // étiquettes
  doc.setFontSize(6.5);
  setColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Barre d’outils', x + w / 2, y0 - 1.2, { align: 'center' });
  doc.text('Outils', x - 1, y0 + h + 3, { align: 'left' });
  doc.text('Plan du réseau', x + w / 2 - 6, y0 + h + 3, { align: 'center' });
  doc.text('Propriétés / Résultats', x + w - 1, y0 + h + 3, { align: 'right' });
}

function illusNetwork(x, y0, w, h) {
  draw(GREY);
  fill([248, 250, 252]);
  doc.setLineWidth(0.2);
  doc.rect(x, y0, w, h, 'FD');
  const N = {
    R: [x + 10, y0 + h - 12],
    A: [x + 30, y0 + 12],
    B: [x + w - 22, y0 + 12],
    C: [x + w - 22, y0 + h - 12],
    D: [x + 30, y0 + h - 12],
  };
  const pipes = [
    ['R', 'A', BRAND],
    ['A', 'B', RED],
    ['B', 'C', RED],
    ['C', 'D', GREEN],
    ['D', 'A', GREEN],
  ];
  doc.setLineWidth(1.1);
  for (const [a, b, c] of pipes) {
    draw(c);
    doc.line(N[a][0], N[a][1], N[b][0], N[b][1]);
  }
  // bâche (source)
  fill(TEAL);
  draw([15, 23, 42]);
  doc.setLineWidth(0.2);
  doc.triangle(N.R[0] - 3.5, N.R[1] - 3, N.R[0] + 3.5, N.R[1] - 3, N.R[0], N.R[1] + 3, 'FD');
  // nœuds colorés (pression)
  const nodeColors = { A: GREEN, B: ORANGE, C: GREEN, D: RED };
  for (const k of ['A', 'B', 'C', 'D']) {
    fill(nodeColors[k]);
    doc.circle(N[k][0], N[k][1], 2.3, 'FD');
  }
  doc.setFontSize(7);
  setColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Source (bâche)', N.R[0] + 5, N.R[1] + 1);
}

function illusLegend(x, y0) {
  const items = [
    [RED, 'Insuffisante  (< 20 m)'],
    [GREEN, 'Conforme  (20–60 m)'],
    [ORANGE, 'Excessive  (> 60 m)'],
  ];
  doc.setFontSize(9.5);
  items.forEach((it, i) => {
    const yy = y0 + i * 7;
    fill(it[0]);
    doc.roundedRect(x, yy, 5, 5, 1, 1, 'F');
    setColor(DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(it[1], x + 8, yy + 3.8);
  });
  const vit = [
    [GREY, 'Vitesse trop faible  (< 0,3 m/s) — stagnation'],
    [GREEN, 'Vitesse correcte'],
    [RED, 'Vitesse trop élevée  (> 1,5 m/s) — érosion'],
  ];
  vit.forEach((it, i) => {
    const yy = y0 + 24 + i * 7;
    fill(it[0]);
    doc.roundedRect(x, yy, 5, 5, 1, 1, 'F');
    setColor(DARK);
    doc.text(it[1], x + 8, yy + 3.8);
  });
  return y0 + 24 + 3 * 7;
}

// ============ PAGE DE COUVERTURE ============
fill(BRAND);
doc.rect(0, 0, W, 80, 'F');
try {
  const icon = readFileSync('build/icon.png').toString('base64');
  doc.addImage('data:image/png;base64,' + icon, 'PNG', W / 2 - 17, 22, 34, 34);
} catch {
  /* pas d'icône */
}
doc.setFont('helvetica', 'bold');
doc.setFontSize(30);
doc.setTextColor(255, 255, 255);
doc.text('HydroNet', W / 2, 70, { align: 'center' });

doc.setFont('helvetica', 'normal');
doc.setFontSize(15);
setColor(DARK);
doc.text('Manuel d’utilisation', W / 2, 105, { align: 'center' });
doc.setFontSize(11);
setColor(MUTED);
doc.text('Modélisation et simulation des réseaux d’eau sous pression', W / 2, 114, { align: 'center' });

illusNetwork(M + 20, 130, CW - 40, 70);
doc.setFontSize(9);
setColor(MUTED);
doc.text('Version 1.0  ·  © 2026 NovaSoft  ·  hichemnar6@gmail.com', W / 2, 215, { align: 'center' });
newPage();

// ============ 1. INTRODUCTION ============
h1('1. Présentation');
para(
  'HydroNet est un logiciel de modélisation et de simulation des réseaux d’eau sous pression (adduction et distribution d’eau potable). Il combine un éditeur graphique de réseau, un moteur de calcul hydraulique de référence (EPANET) et des rapports professionnels.',
);
para('Il permet de dessiner un réseau, de définir les caractéristiques des éléments, de lancer une simulation (régime permanent ou sur 24 h), puis d’analyser et d’exporter les résultats.');
h2('Vue d’ensemble de l’interface');
illusInterface(M + 8, y, CW - 16, 58);
y += 64;
caption('Disposition : barre d’outils (haut), palette d’outils (gauche), plan du réseau (centre), propriétés et résultats (droite).');
bullet('Barre d’outils : Fichier, Édition, Catalogue & courbes, Paramètres, Lancer la simulation, Exporter, Aide.');
bullet('Palette d’outils (gauche) : sélection, déplacement, et éléments à dessiner.');
bullet('Plan : zone de dessin à l’échelle réelle (avec fond de plan DXF optionnel).');
bullet('Panneau de droite : propriétés de l’élément sélectionné et résultats de simulation.');

// ============ 2. DESSINER ============
h1('2. Dessiner le réseau');
para('Choisissez un outil dans la palette puis cliquez sur le plan pour placer les éléments :');
bullet('Nœud de demande : point de consommation (cote, demande de base, modulation).');
bullet('Bâche à eau / Source : réservoir à charge fixe (alimentation).');
bullet('Réservoir (stockage) : niveau variable (cote, niveaux min/max, diamètre).');
bullet('Conduite : reliez deux nœuds ; choisissez d’abord matériau, DN et PN dans la barre « Tube à dessiner ».');
bullet('Pompe et Vanne : organes hydrauliques (courbe de pompe, type et consigne de vanne).');
h2('Tracé des conduites');
bullet('La case « Courbure (rayon) » : cochée = angles arrondis ; décochée = coins vifs (sans rayon).');
bullet('« Angles normalisés » : accroche le tracé sur des angles de coude du commerce.');
bullet('Touche Échap : annule le tracé en cours et revient à l’outil Sélection.');
para('Le diamètre intérieur utilisé pour l’hydraulique vaut DN − 2 × épaisseur (issu du catalogue).');

// ============ 3. CATALOGUE ============
h1('3. Catalogue de conduites');
para('Le catalogue regroupe les matériaux et leurs dimensions. Il est entièrement modifiable via « Catalogue & courbes ▾ → Catalogue de conduites ».');
bullet('Par matériau : nom, norme, rugosités (Hazen-Williams C, Darcy ε, Manning n) et facteur de rayon de courbure (× DN).');
bullet('Par dimension : DN extérieur, PN, épaisseur — le SDR (= DN/épaisseur) et le Ø intérieur sont calculés automatiquement.');
bullet('Édition en brouillon : les modifications ne s’appliquent qu’après « Enregistrer » (avec confirmation).');
bullet('Export / Import : sauvegardez le catalogue dans un fichier .hydrocat pour le partager ou le réutiliser.');

// ============ 4. PARAMÈTRES ============
h1('4. Paramètres de simulation');
para('Le bouton « Paramètres » regroupe tous les réglages de calcul :');
bullet('Unités de débit et formule de perte de charge (Hazen-Williams, Darcy-Weisbach, Chézy-Manning).');
bullet('Durée de simulation et pas de temps (régime permanent si durée = 0).');
bullet('Options hydrauliques : densité, viscosité, itérations, précision.');
bullet('Critères de conformité : pression min/max, vitesse min (auto-curage) / max.');

// ============ 5. COURBES & MODULATIONS ============
h1('5. Courbes et modulations');
bullet('Courbes : caractéristique de pompe (débit→hauteur), rendement, volume, perte de charge.');
bullet('Modulations : coefficients horaires sur 24 h appliqués à la demande aux nœuds ou à la vitesse de rotation d’une pompe.');

// ============ 6. SIMULATION & RÉSULTATS ============
h1('6. Simulation et résultats');
para('Cliquez sur « Lancer la simulation ». Les résultats colorent le réseau et s’affichent dans le panneau de droite ; pour une simulation sur durée, la barre de temps permet de parcourir les heures.');
illusNetwork(M + 12, y, CW - 24, 60);
y += 66;
caption('Exemple : réseau coloré selon les résultats (nœuds par pression, conduites par état).');

// ============ 7. LÉGENDE & COULEURS ============
h1('7. Légende et couleurs');
para('Deux modes complémentaires :');
h2('Valeurs (intervalles fixes)');
para('Coloration par seuils absolus personnalisables (pression, vitesse, débit…). Une pression de 2 m apparaît en bas d’échelle (bleu) et non en rouge — l’interprétation reste juste.');
h2('Conformité (recommandé pour l’analyse)');
ensure(58);
y = illusLegend(M + 4, y) + 4;
caption('La légende affiche aussi le nombre d’éléments dans chaque état au pas de temps courant.');

// ============ 8. SÉLECTION PAR FILTRE ============
h1('8. Sélection par filtre');
para('Le bouton « Sélection » permet de sélectionner en masse des éléments selon un critère : par exemple toutes les conduites dont la vitesse maximale est inférieure à 0,3 m/s, ou tous les nœuds dont la pression est insuffisante. On peut aussi « tout sélectionner » par famille (nœuds, conduites, pompes, vannes).');

// ============ 9. EXPORTER ============
h1('9. Exporter');
bullet('Rapport PDF : note de calcul avec plan, résultats et conformité.');
bullet('EPANET (.inp) : fichier compatible avec EPANET.');
bullet('AutoCAD (.dxf) : plan coté avec légende et choix de l’échelle de tracé.');

// ============ 10. FICHIERS & LICENCE ============
h1('10. Fichiers et licence');
bullet('Fichier : Nouveau, Ouvrir, Enregistrer / Enregistrer sous (choix du dossier), projets récents. Format .hydronet.');
bullet('Licence : HydroNet requiert une clé d’activation liée au poste (saisie au premier lancement). Voir Aide ▸ À propos / Licence.');

para(' ');
para('Pour toute question : hichemnar6@gmail.com — © 2026 NovaSoft. Les résultats de simulation doivent être vérifiés par un ingénieur qualifié avant toute décision.');

footer();
const out = 'HydroNet - Manuel utilisateur.pdf';
writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('PDF généré :', out, '(' + doc.getNumberOfPages() + ' pages)');
