// Bibliothèque de conduites prédéfinies.
// Source : catalogue SETIF PIPE — Tubes PEHD PE100, norme EN 12201 / NA 7700.
// Le diamètre nominal (DN) est le diamètre EXTÉRIEUR ; le diamètre intérieur
// (utilisé pour l'hydraulique) vaut DN − 2 × épaisseur.

export interface PipeSize {
  pn: number; // pression nominale (bar)
  sdr: number; // Standard Dimension Ratio
  thickness: number; // épaisseur de paroi (mm)
  innerDiameter: number; // diamètre intérieur (mm) = dn − 2·ep
}

export interface CatalogDiameter {
  dn: number; // diamètre extérieur nominal (mm)
  sizes: PipeSize[];
}

export interface PipeMaterial {
  id: string;
  name: string;
  norm: string;
  /** Coefficient de Hazen-Williams (C) pour ce matériau. */
  hwRoughness: number;
  /** Rugosité absolue (mm) pour Darcy-Weisbach. */
  dwRoughness: number;
  /** Coefficient de Manning (n) pour Chézy-Manning. */
  cmRoughness: number;
  diameters: CatalogDiameter[];
}

const SDR_BY_PN: Record<number, number> = { 6: 26, 10: 17, 16: 11, 20: 9, 25: 7.4 };

// Épaisseurs de paroi (mm) par DN puis par PN. À partir du DN32 (catalogue).
const THICKNESS: Record<number, Partial<Record<number, number>>> = {
  32: { 10: 2.0, 16: 3.0, 20: 3.6, 25: 4.4 },
  40: { 10: 2.4, 16: 3.7, 20: 4.5, 25: 5.5 },
  50: { 6: 2.0, 10: 3.0, 16: 4.6, 20: 5.6, 25: 6.9 },
  63: { 6: 2.5, 10: 3.8, 16: 5.8, 20: 7.1, 25: 8.6 },
  75: { 6: 2.9, 10: 4.5, 16: 6.8, 20: 8.4, 25: 10.3 },
  90: { 6: 3.5, 10: 5.4, 16: 8.2, 20: 10.1, 25: 12.3 },
  110: { 6: 4.2, 10: 6.6, 16: 10.0, 20: 12.3, 25: 15.1 },
  125: { 6: 4.8, 10: 7.4, 16: 11.4, 20: 14.0, 25: 17.1 },
  160: { 6: 6.2, 10: 9.5, 16: 14.6, 20: 17.9, 25: 21.9 },
  200: { 6: 7.7, 10: 11.9, 16: 18.2, 20: 22.4, 25: 27.4 },
  250: { 6: 9.6, 10: 14.8, 16: 22.7, 20: 27.9, 25: 34.2 },
  315: { 6: 12.1, 10: 18.7, 16: 28.6, 20: 35.2, 25: 43.1 },
  400: { 6: 15.3, 10: 23.7, 16: 36.3, 20: 44.7, 25: 54.7 },
  500: { 6: 19.1, 10: 29.7, 16: 45.4, 20: 55.8 },
  630: { 6: 24.1, 10: 37.4, 16: 57.2 },
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function buildDiameters(): CatalogDiameter[] {
  return Object.keys(THICKNESS)
    .map(Number)
    .sort((a, b) => a - b)
    .map((dn) => {
      const perPn = THICKNESS[dn];
      const sizes: PipeSize[] = Object.keys(perPn)
        .map(Number)
        .sort((a, b) => a - b)
        .map((pn) => {
          const thickness = perPn[pn]!;
          return {
            pn,
            sdr: SDR_BY_PN[pn],
            thickness,
            innerDiameter: round1(dn - 2 * thickness),
          };
        });
      return { dn, sizes };
    });
}

export const PEHD_PE100: PipeMaterial = {
  id: 'pehd-pe100',
  name: 'PEHD PE100 (SETIF PIPE)',
  norm: 'EN 12201',
  hwRoughness: 150, // PE : très lisse
  dwRoughness: 0.0015,
  cmRoughness: 0.009,
  diameters: buildDiameters(),
};

export const PIPE_MATERIALS: PipeMaterial[] = [PEHD_PE100];

export function getMaterial(id: string | undefined): PipeMaterial | undefined {
  return PIPE_MATERIALS.find((m) => m.id === id);
}

export function getDiameter(material: PipeMaterial, dn: number): CatalogDiameter | undefined {
  return material.diameters.find((d) => d.dn === dn);
}

export function getSize(material: PipeMaterial, dn: number, pn: number): PipeSize | undefined {
  return getDiameter(material, dn)?.sizes.find((s) => s.pn === pn);
}

/** Rugosité adaptée au matériau selon la formule de perte de charge. */
export function materialRoughness(material: PipeMaterial, formula: string): number {
  if (formula === 'D-W') return material.dwRoughness;
  if (formula === 'C-M') return material.cmRoughness;
  return material.hwRoughness; // H-W par défaut
}
