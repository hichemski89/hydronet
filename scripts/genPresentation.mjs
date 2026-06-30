// Génère le DOSSIER DE PRÉSENTATION de HydroNet : présentation commerciale,
// dossier technique (pour dépôt INAPI / propriété intellectuelle) et manuel
// d'utilisation, en un seul PDF professionnel.
// Usage : node scripts/genPresentation.mjs
import { jsPDF } from 'jspdf';
import { readFileSync, writeFileSync } from 'fs';

const BRAND = [29, 78, 216];
const BRANDD = [30, 58, 138];
const DARK = [15, 23, 42];
const MUTED = [100, 116, 139];
const GREEN = [22, 163, 74];
const ORANGE = [217, 119, 6];
const RED = [220, 38, 38];
const TEAL = [13, 148, 136];
const GREY = [148, 163, 184];
const LIGHT = [248, 250, 252];
const BORDER = [226, 232, 240];

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const W = 210;
const H = 297;
const M = 20;
const CW = W - 2 * M;
let y = M;

const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);
const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
const draw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

function footer() {
  doc.setFontSize(8);
  setColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('HydroNet — Dossier de présentation', M, H - 10);
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
  const lines = doc.splitTextToSize(t, CW);
  for (const ln of lines) {
    ensure(5);
    doc.text(ln, M, y + 3);
    y += 4.6;
  }
  y += 1.5;
}

// Bandeau de partie (séparateur de grande section)
function partBanner(num, t) {
  ensure(26);
  y += 2;
  fill(BRANDD);
  doc.rect(M, y, CW, 18, 'F');
  fill(BRAND);
  doc.rect(M, y, 2.5, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor([147, 197, 253]);
  doc.text('PARTIE ' + num, M + 8, y + 7);
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(t, M + 8, y + 14);
  y += 24;
}

// Tableau clé / valeur (2 colonnes)
function kvTable(rows, c1 = 52) {
  rows.forEach(([k, v], i) => {
    const vlines = doc.splitTextToSize(v, CW - c1 - 6);
    const h = Math.max(7.5, vlines.length * 4.8 + 3);
    ensure(h);
    if (i % 2 === 0) {
      fill(LIGHT);
      doc.rect(M, y, CW, h, 'F');
    }
    draw(BORDER);
    doc.setLineWidth(0.1);
    doc.rect(M, y, CW, h);
    doc.line(M + c1, y, M + c1, y + h);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.3);
    setColor(BRANDD);
    const klines = doc.splitTextToSize(k, c1 - 5);
    klines.forEach((ln, j) => doc.text(ln, M + 3, y + 5 + j * 4.6));
    doc.setFont('helvetica', 'normal');
    setColor(DARK);
    vlines.forEach((ln, j) => doc.text(ln, M + c1 + 3, y + 5 + j * 4.8));
    y += h;
  });
  y += 4;
}

// Tableau générique avec en-tête
function table(headers, rows, widths) {
  const headerH = 8;
  ensure(headerH + 10);
  fill(BRAND);
  doc.rect(M, y, CW, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.3);
  let x = M;
  headers.forEach((hd, i) => {
    doc.text(hd, x + 3, y + 5.4);
    x += widths[i];
  });
  y += headerH;
  rows.forEach((r, ri) => {
    const cells = r.map((cell, i) => doc.splitTextToSize(String(cell), widths[i] - 5));
    const h = Math.max(7.5, ...cells.map((c) => c.length * 4.6 + 3));
    ensure(h);
    if (ri % 2 === 0) {
      fill(LIGHT);
      doc.rect(M, y, CW, h, 'F');
    }
    draw(BORDER);
    doc.setLineWidth(0.1);
    doc.rect(M, y, CW, h);
    let cx = M;
    cells.forEach((c, i) => {
      setColor(DARK);
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.setFontSize(9);
      c.forEach((ln, j) => doc.text(ln, cx + 3, y + 5 + j * 4.6));
      if (i > 0) {
        draw(BORDER);
        doc.line(cx, y, cx, y + h);
      }
      cx += widths[i];
    });
    y += h;
  });
  y += 4;
}

// Encadré d'information
function callout(title, text, color = TEAL) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  const lines = doc.splitTextToSize(text, CW - 12);
  const h = lines.length * 4.9 + 11;
  ensure(h);
  fill([240, 249, 255]);
  doc.rect(M, y, CW, h, 'F');
  fill(color);
  doc.rect(M, y, 2.5, h, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(color);
  doc.text(title, M + 6, y + 6);
  doc.setFont('helvetica', 'normal');
  setColor(DARK);
  lines.forEach((ln, j) => doc.text(ln, M + 6, y + 11 + j * 4.9));
  y += h + 4;
}

// ---------- Illustrations vectorielles ----------
function illusInterface(x, y0, w, h) {
  draw(GREY);
  fill(LIGHT);
  doc.setLineWidth(0.2);
  doc.rect(x, y0, w, h, 'FD');
  fill([255, 255, 255]);
  doc.rect(x, y0, w, 7, 'FD');
  fill(BRAND);
  doc.roundedRect(x + 2, y0 + 1.6, 3.6, 3.6, 0.6, 0.6, 'F');
  doc.setFontSize(7);
  setColor(DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('HydroNet', x + 7, y0 + 4.4);
  fill(BORDER);
  for (let i = 0; i < 6; i++) doc.roundedRect(x + 26 + i * 11, y0 + 1.8, 9, 3.2, 0.5, 0.5, 'F');
  fill([255, 255, 255]);
  doc.rect(x, y0 + 7, 8, h - 7, 'FD');
  fill(BORDER);
  for (let i = 0; i < 7; i++) doc.roundedRect(x + 2, y0 + 10 + i * 5, 4, 4, 0.6, 0.6, 'F');
  fill([255, 255, 255]);
  doc.rect(x + w - 30, y0 + 7, 30, h - 7, 'FD');
  fill(BORDER);
  for (let i = 0; i < 5; i++) doc.rect(x + w - 27, y0 + 12 + i * 7, 24, 3.5, 'F');
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
  fill(LIGHT);
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
  fill(TEAL);
  draw(DARK);
  doc.setLineWidth(0.2);
  doc.triangle(N.R[0] - 3.5, N.R[1] - 3, N.R[0] + 3.5, N.R[1] - 3, N.R[0], N.R[1] + 3, 'FD');
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
doc.rect(0, 0, W, 88, 'F');
fill(BRANDD);
doc.rect(0, 80, W, 8, 'F');
try {
  const icon = readFileSync('build/icon.png').toString('base64');
  doc.addImage('data:image/png;base64,' + icon, 'PNG', W / 2 - 18, 20, 36, 36);
} catch {
  /* pas d'icône */
}
doc.setFont('helvetica', 'bold');
doc.setFontSize(32);
doc.setTextColor(255, 255, 255);
doc.text('HydroNet', W / 2, 74, { align: 'center' });

doc.setFont('helvetica', 'bold');
doc.setFontSize(17);
setColor(DARK);
doc.text('Dossier de présentation', W / 2, 108, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
setColor(MUTED);
doc.text('Présentation · Architecture technique · Manuel d’utilisation', W / 2, 117, { align: 'center' });

doc.setFontSize(11.5);
setColor(BRANDD);
doc.setFont('helvetica', 'bold');
doc.text('Logiciel de modélisation et de simulation des réseaux d’eau sous pression', W / 2, 130, {
  align: 'center',
});

illusNetwork(M + 22, 140, CW - 44, 72);

fill(LIGHT);
draw(BORDER);
doc.setLineWidth(0.2);
doc.rect(M + 25, 222, CW - 50, 32, 'FD');
doc.setFontSize(9.5);
setColor(DARK);
doc.setFont('helvetica', 'bold');
doc.text('Auteur : Hichem Narcis  ·  Éditeur : NovaSoft', W / 2, 230, { align: 'center' });
doc.setFont('helvetica', 'normal');
setColor(MUTED);
doc.text('Version 1.0  ·  © 2026 NovaSoft  ·  Tous droits réservés', W / 2, 237, { align: 'center' });
doc.text('Contact : hichemnar6@gmail.com', W / 2, 244, { align: 'center' });
doc.text('Document confidentiel — usage commercial et dépôt de propriété intellectuelle', W / 2, 251, {
  align: 'center',
});
newPage();

// ============ SOMMAIRE ============
h1('Sommaire');
const toc = [
  ['PARTIE I — Présentation générale', ''],
  ['   1.  Fiche signalétique du logiciel', ''],
  ['   2.  Présentation et finalité', ''],
  ['   3.  Contexte et problème résolu', ''],
  ['   4.  Public cible et cas d’usage', ''],
  ['   5.  Positionnement par rapport à EPANET', ''],
  ['PARTIE II — Architecture et dossier technique', ''],
  ['   6.  Technologies et langages employés', ''],
  ['   7.  Architecture logicielle', ''],
  ['   8.  Le moteur de calcul hydraulique', ''],
  ['   9.  Formats de fichiers et interopérabilité', ''],
  ['  10.  Sécurité et protection par licence', ''],
  ['  11.  Ampleur et originalité du travail', ''],
  ['PARTIE III — Manuel d’utilisation', ''],
  ['  12.  Vue d’ensemble de l’interface', ''],
  ['  13.  Dessiner le réseau', ''],
  ['  14.  Catalogue de conduites', ''],
  ['  15.  Paramètres, courbes et modulations', ''],
  ['  16.  Simulation et analyse des résultats', ''],
  ['  17.  Exporter et partager', ''],
  ['PARTIE IV — Propriété intellectuelle', ''],
  ['  18.  Droits, licence et mentions légales', ''],
];
doc.setFontSize(10.5);
toc.forEach(([t]) => {
  ensure(7);
  const isPart = t.startsWith('PARTIE');
  doc.setFont('helvetica', isPart ? 'bold' : 'normal');
  setColor(isPart ? BRAND : DARK);
  doc.text(t, M + (isPart ? 0 : 2), y + 4);
  y += isPart ? 8 : 6.2;
});
newPage();

// ============ PARTIE I ============
partBanner('I', 'Présentation générale');

h1('1. Fiche signalétique du logiciel');
kvTable([
  ['Nom du logiciel', 'HydroNet'],
  ['Version', '1.0'],
  ['Auteur', 'Hichem Narcis'],
  ['Éditeur / Titulaire des droits', 'NovaSoft'],
  ['Contact', 'hichemnar6@gmail.com'],
  ['Année de création', '2026'],
  ['Catégorie', 'Logiciel d’ingénierie — modélisation et simulation hydraulique (CAO)'],
  ['Domaine d’application', 'Réseaux d’adduction et de distribution d’eau potable sous pression'],
  ['Plateforme', 'Application de bureau Windows (10/11), 64 bits'],
  ['Langages de programmation', 'TypeScript, JavaScript (Node.js), HTML5, CSS3'],
  ['Moteur de calcul', 'EPANET (via epanet-js, portage WebAssembly officiel)'],
  ['Volume de code', 'Environ 10 500 lignes — 52 fichiers source (hors bibliothèques)'],
  ['Langue de l’interface', 'Français'],
  ['Régime de protection', 'Logiciel propriétaire — activation par clé liée au poste'],
  ['Copyright', '© 2026 NovaSoft — Tous droits réservés'],
]);

h1('2. Présentation et finalité');
para(
  'HydroNet est un logiciel professionnel de modélisation et de simulation des réseaux d’eau sous pression (adduction et distribution d’eau potable). Il réunit, en une seule application, un éditeur graphique de réseau, un moteur de calcul hydraulique de référence et un module de production de rapports techniques.',
);
para(
  'L’utilisateur dessine le réseau à l’écran, définit les caractéristiques de chaque élément (nœuds de demande, réservoirs, châteaux d’eau, conduites, pompes, vannes), lance une simulation — en régime permanent ou sur une durée de 24 heures et plus — puis analyse, vérifie la conformité et exporte les résultats sous forme de notes de calcul, de plans cotés ou de fichiers d’échange.',
);
callout(
  'Principe directeur',
  'Le calcul hydraulique est assuré par EPANET lui-même : les résultats sont identiques au logiciel de référence mondial. Toute la valeur ajoutée de HydroNet porte sur l’expérience utilisateur, l’intégration des outils métier et la qualité de restitution.',
);

h1('3. Contexte et problème résolu');
para(
  'EPANET, développé par l’agence américaine de protection de l’environnement, est la référence mondiale du calcul des réseaux d’eau. Toutefois, son interface n’a pas évolué depuis des décennies : ergonomie datée, langue anglaise uniquement, absence de catalogue de matériaux, rapports en texte brut et interopérabilité CAO limitée.',
);
para('HydroNet répond à ces limites en conservant la fiabilité du moteur EPANET tout en apportant :');
bullet('Une interface moderne, fluide et entièrement en français.');
bullet('Un catalogue de conduites intégré (matériaux, diamètres normalisés, pressions nominales) avec calcul automatique du diamètre intérieur hydraulique.');
bullet('Une analyse de conformité automatique (pressions et vitesses) avec code couleur lisible.');
bullet('Des rapports PDF de qualité professionnelle et un échange direct avec les logiciels de DAO (format DXF).');

h1('4. Public cible et cas d’usage');
para('HydroNet s’adresse aux professionnels de l’hydraulique urbaine :');
bullet('Bureaux d’études et ingénieurs hydrauliciens (conception et dimensionnement de réseaux).');
bullet('Collectivités, régies et services techniques de l’eau (diagnostic et exploitation).');
bullet('Entreprises de travaux et concessionnaires (vérification de projets).');
bullet('Enseignement et formation en hydraulique (support pédagogique en français).');
para('Cas d’usage typiques : dimensionnement d’un réseau neuf, vérification de pressions de service, détection des zones de stagnation ou d’érosion, étude d’un renforcement, production d’une note de calcul réglementaire.');

h1('5. Positionnement par rapport à EPANET');
table(
  ['Critère', 'EPANET (interface classique)', 'HydroNet'],
  [
    ['Moteur de calcul', 'EPANET', 'EPANET — résultats identiques'],
    ['Interface', 'Datée, peu ergonomique', 'Moderne, repensée, fluide'],
    ['Langue', 'Anglais uniquement', 'Français'],
    ['Catalogue de conduites', 'Saisie manuelle', 'Intégré : matériaux, DN, PN, Ø intérieur automatique'],
    ['Fond de plan CAO', 'Très limité', 'Import DXF + export de plan coté'],
    ['Rapports', 'Texte brut', 'PDF professionnels (plan, tableaux, conformité)'],
    ['Analyse de conformité', 'Manuelle', 'Automatique, par code couleur'],
    ['Protection commerciale', 'Logiciel libre', 'Propriétaire, activation sécurisée'],
  ],
  [38, 66, CW - 38 - 66],
);

// ============ PARTIE II ============
partBanner('II', 'Architecture et dossier technique');

h1('6. Technologies et langages employés');
para(
  'HydroNet est une application de bureau bâtie sur des technologies web modernes, empaquetées pour Windows. L’ensemble du code applicatif est original ; seules des bibliothèques tierces reconnues sont utilisées comme briques de base.',
);
table(
  ['Couche', 'Technologie', 'Rôle'],
  [
    ['Interface (IHM)', 'React 19 + TypeScript', 'Interface utilisateur, composants graphiques'],
    ['Rendu du plan', 'SVG + Canvas', 'Éditeur de réseau (pan, zoom, tracé)'],
    ['Application de bureau', 'Electron 42', 'Empaquetage Windows, fenêtre native, installeur'],
    ['Outil de construction', 'Vite 8', 'Compilation et optimisation du code'],
    ['Gestion d’état', 'Zustand 5', 'État global du réseau et des actions'],
    ['Moteur hydraulique', 'epanet-js (EPANET WASM)', 'Résolution hydraulique'],
    ['Graphiques', 'Recharts 3', 'Courbes d’évolution temporelle'],
    ['Rapports PDF', 'jsPDF + jspdf-autotable', 'Génération des notes de calcul'],
    ['Interopérabilité CAO', 'dxf-parser', 'Lecture des fonds de plan DXF'],
    ['Serveur de licences', 'Node.js + Express', 'Activation et validation des clés'],
    ['Signature & chiffrement', 'Ed25519 (WebCrypto), safeStorage', 'Sécurité des licences'],
  ],
  [42, 58, CW - 42 - 58],
);

h1('7. Architecture logicielle');
para(
  'Le logiciel est organisé en modules clairement séparés, suivant une architecture en couches : modèle de données, moteur, interface et services. Cette structure facilite la maintenance et l’évolution.',
);
h2('Modules applicatifs (client)');
table(
  ['Module', 'Contenu', 'Responsabilité'],
  [
    ['Modèle de données', 'types/network.ts', 'Description des nœuds, liens, options et résultats'],
    ['État & actions', 'store/networkStore.ts', 'Édition, sélection, historique (annuler/refaire)'],
    ['Moteur', 'engine/ (6 fichiers)', 'Génération .inp, exécution EPANET, import/export'],
    ['Interface', 'components/ (26 composants)', 'Éditeur, panneaux, dialogues, barres d’outils'],
    ['Utilitaires', 'utils/ (9 fichiers)', 'Couleurs, conformité, géométrie, capture du plan'],
    ['Rapports', 'report/reportGenerator.ts', 'Note de calcul PDF'],
    ['Catalogue', 'data/pipeCatalog.ts', 'Matériaux et dimensions normalisées'],
    ['Licence', 'license/ (2 fichiers)', 'Vérification de signature et activation'],
  ],
  [40, 52, CW - 40 - 52],
);
h2('Chaîne de traitement hydraulique');
para(
  'Le réseau dessiné est traduit en un fichier au format EPANET (.inp) par le module inpBuilder, exécuté par le moteur EPANET (epanetRunner via epanet-js), puis les résultats sont lus et restitués à l’écran (coloration, graphiques) et dans les rapports. Le module inpParser assure l’opération inverse (import de modèles EPANET existants).',
);

h1('8. Le moteur de calcul hydraulique');
para(
  'HydroNet n’invente pas un nouveau solveur hydraulique : il s’appuie sur EPANET, le moteur de référence internationale, via son portage officiel en WebAssembly (epanet-js). Ce choix garantit des résultats exacts, vérifiables et reconnus par la profession.',
);
bullet('Formules de perte de charge : Hazen-Williams, Darcy-Weisbach, Chézy-Manning.');
bullet('Régime permanent (instantané) ou simulation étendue sur la durée (24 h et plus).');
bullet('Prise en compte des courbes de pompes, des modulations horaires de demande, des réservoirs à niveau variable.');
callout(
  'Garantie de fiabilité',
  'Parce que le cœur de calcul est EPANET, tout résultat produit par HydroNet est identique à celui qu’obtiendrait un ingénieur avec EPANET — un gage de confiance essentiel pour des ouvrages publics.',
  GREEN,
);

h1('9. Formats de fichiers et interopérabilité');
table(
  ['Format', 'Extension', 'Usage'],
  [
    ['Projet HydroNet', '.hydronet', 'Sauvegarde et ouverture des projets (format natif)'],
    ['Catalogue de conduites', '.hydrocat', 'Partage et réutilisation des matériaux'],
    ['EPANET', '.inp', 'Import et export — compatibilité avec EPANET'],
    ['AutoCAD / DAO', '.dxf', 'Import de fond de plan, export de plan coté'],
    ['Rapport', '.pdf', 'Note de calcul professionnelle'],
  ],
  [46, 30, CW - 46 - 30],
);

h1('10. Sécurité et protection par licence');
para(
  'HydroNet intègre un système de licences propriétaire conçu pour la commercialisation. Il repose sur une cryptographie moderne et une liaison au poste de travail.',
);
bullet('Activation par clé : chaque clé est liée à un poste unique (empreinte matérielle du poste).');
bullet('Signature numérique Ed25519 : les activations sont signées par le serveur et vérifiées localement — une licence ne peut être forgée.');
bullet('Stockage chiffré : le jeton de licence est protégé par le coffre du système d’exploitation (safeStorage).');
bullet('Vérification d’intégrité : l’application contrôle au démarrage qu’aucun fichier n’a été altéré.');
bullet('Serveur d’activation dédié avec révocation possible des clés et licences d’essai à durée limitée.');

h1('11. Ampleur et originalité du travail');
para('Le développement de HydroNet représente un travail logiciel substantiel et original :');
kvTable([
  ['Code source applicatif', 'Environ 10 500 lignes (TypeScript / React)'],
  ['Fichiers source', '52 fichiers organisés en 9 modules'],
  ['Composants d’interface', '26 composants graphiques'],
  ['Modules moteur', '6 modules (génération, exécution, import/export)'],
  ['Serveur de licences', 'Service réseau dédié (Node.js, ~260 lignes)'],
  ['Éléments originaux', 'Interface, catalogue, conformité, interopérabilité DXF, licences'],
]);
para(
  'Les éléments protégeables au titre de la propriété intellectuelle comprennent notamment : la conception de l’interface et de l’expérience utilisateur, le système de catalogue de conduites, le module d’analyse de conformité, l’interopérabilité DXF (fond de plan et plan coté), le générateur de rapports et le système de protection par licence — l’ensemble constituant une œuvre logicielle originale.',
);

// ============ PARTIE III ============
partBanner('III', 'Manuel d’utilisation');

h1('12. Vue d’ensemble de l’interface');
illusInterface(M + 8, y, CW - 16, 58);
y += 64;
caption('Disposition : barre d’outils (haut), palette d’outils (gauche), plan du réseau (centre), propriétés et résultats (droite).');
bullet('Barre d’outils : Fichier, Édition, Catalogue & courbes, Paramètres, Lancer la simulation, Exporter, Aide.');
bullet('Palette d’outils (gauche) : sélection, déplacement, et éléments à dessiner.');
bullet('Plan : zone de dessin à l’échelle réelle (avec fond de plan DXF optionnel).');
bullet('Panneau de droite : propriétés de l’élément sélectionné et résultats de simulation.');

h1('13. Dessiner le réseau');
para('Choisissez un outil dans la palette puis cliquez sur le plan pour placer les éléments :');
bullet('Nœud de demande : point de consommation (cote, demande de base, modulation).');
bullet('Bâche à eau / Source : réservoir à charge fixe (alimentation).');
bullet('Réservoir (stockage) : niveau variable (cote, niveaux min/max, diamètre).');
bullet('Conduite : reliez deux nœuds ; choisissez d’abord matériau, DN et PN dans la barre « Tube à dessiner ».');
bullet('Pompe et Vanne : organes hydrauliques (courbe de pompe, type et consigne de vanne).');
h2('Tracé des conduites');
bullet('La case « Courbure (rayon) » : cochée = angles arrondis ; décochée = coins vifs.');
bullet('« Angles normalisés » : accroche le tracé sur des angles de coude du commerce.');
bullet('Magnétisme (grille) : aligne les points sur une grille ; touche Échap : annule le tracé en cours.');
para('Le diamètre intérieur utilisé pour l’hydraulique vaut DN − 2 × épaisseur (issu du catalogue).');

h1('14. Catalogue de conduites');
para('Le catalogue regroupe les matériaux et leurs dimensions. Il est entièrement modifiable via « Catalogue & courbes ▾ → Catalogue de conduites ».');
bullet('Par matériau : nom, norme, rugosités (Hazen-Williams C, Darcy ε, Manning n) et facteur de rayon de courbure.');
bullet('Par dimension : DN extérieur, PN, épaisseur — le SDR et le Ø intérieur sont calculés automatiquement.');
bullet('Édition en brouillon : les modifications ne s’appliquent qu’après « Enregistrer ».');
bullet('Export / Import : sauvegardez le catalogue dans un fichier .hydrocat pour le partager.');

h1('15. Paramètres, courbes et modulations');
h2('Paramètres de simulation');
bullet('Unités de débit et formule de perte de charge (Hazen-Williams, Darcy-Weisbach, Chézy-Manning).');
bullet('Durée de simulation et pas de temps (régime permanent si durée = 0).');
bullet('Options hydrauliques : densité, viscosité, itérations, précision.');
bullet('Critères de conformité : pression min/max, vitesse min (auto-curage) / max.');
h2('Courbes et modulations');
bullet('Courbes : caractéristique de pompe (débit→hauteur), rendement, volume, perte de charge.');
bullet('Modulations : coefficients horaires sur 24 h appliqués à la demande ou à la vitesse d’une pompe.');

h1('16. Simulation et analyse des résultats');
para(
  'Cliquez sur « Lancer la simulation ». Les résultats colorent le réseau et s’affichent dans le panneau de droite ; pour une simulation sur durée, la barre de temps permet de parcourir les heures.',
);
illusNetwork(M + 12, y, CW - 24, 58);
y += 64;
caption('Exemple : réseau coloré selon les résultats (nœuds par pression, conduites par état).');
h2('Légende et couleurs');
para('Deux modes complémentaires de coloration :');
bullet('Valeurs (intervalles fixes) : coloration par seuils absolus personnalisables (pression, vitesse, débit…).');
bullet('Conformité (recommandé) : met en évidence les éléments hors normes.');
ensure(58);
y = illusLegend(M + 4, y) + 4;
caption('La légende affiche aussi le nombre d’éléments dans chaque état au pas de temps courant.');
h2('Sélection par filtre');
para(
  'Le bouton « Sélection » permet de sélectionner en masse des éléments selon un critère : par exemple toutes les conduites dont la vitesse maximale est inférieure à 0,3 m/s, ou tous les nœuds dont la pression est insuffisante.',
);

h1('17. Exporter et partager');
bullet('Rapport PDF : note de calcul avec plan, résultats et conformité.');
bullet('EPANET (.inp) : fichier compatible avec EPANET.');
bullet('AutoCAD (.dxf) : plan coté avec légende et choix de l’échelle de tracé.');
bullet('Projet (.hydronet) : enregistrement complet pour réouverture ultérieure.');

// ============ PARTIE IV ============
partBanner('IV', 'Propriété intellectuelle');

h1('18. Droits, licence et mentions légales');
para(
  'HydroNet est un logiciel propriétaire. Il est protégé par le droit d’auteur en tant qu’œuvre logicielle originale. Toute reproduction, distribution, modification ou ingénierie inverse non autorisée est interdite.',
);
kvTable([
  ['Titulaire des droits', 'NovaSoft'],
  ['Auteur', 'Hichem Narcis (hichemnar6@gmail.com)'],
  ['Copyright', '© 2026 NovaSoft — Tous droits réservés'],
  ['Nature de l’œuvre', 'Logiciel d’ingénierie hydraulique (application de bureau)'],
  ['Régime', 'Logiciel propriétaire sous licence par clé d’activation'],
  ['Conditions d’usage', 'Régies par le contrat de licence utilisateur final (EULA)'],
]);
callout(
  'Avertissement technique',
  'Les résultats de simulation produits par HydroNet doivent être vérifiés et validés par un ingénieur qualifié avant toute décision de conception ou d’exploitation d’un ouvrage.',
  ORANGE,
);
para(' ');
para(
  'Document établi pour la présentation commerciale du logiciel et pour les démarches de protection de la propriété intellectuelle (notamment auprès de l’INAPI). Pour toute information complémentaire : hichemnar6@gmail.com — © 2026 NovaSoft.',
);

footer();
const out = 'HydroNet - Dossier de presentation.pdf';
writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('PDF généré :', out, '(' + doc.getNumberOfPages() + ' pages)');
