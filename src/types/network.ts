// Modèle de données du réseau hydraulique
// Inspiré d'EPANET mais avec des types TypeScript stricts.

export type NodeType = 'junction' | 'reservoir' | 'tank';
export type LinkType = 'pipe' | 'pump' | 'valve';

export type ValveKind = 'PRV' | 'PSV' | 'PBV' | 'FCV' | 'TCV' | 'GPV';
export type PumpMode = 'power' | 'head';
export type LinkStatus = 'OPEN' | 'CLOSED' | 'CV';

export interface BaseNode {
  id: string;
  type: NodeType;
  /** Coordonnées dans l'espace modèle (Y vers le haut, comme EPANET). */
  x: number;
  y: number;
  label?: string;
}

export interface Junction extends BaseNode {
  type: 'junction';
  elevation: number;
  /** Demande de base (dans l'unité de débit choisie). */
  baseDemand: number;
  pattern?: string;
}

export interface Reservoir extends BaseNode {
  type: 'reservoir';
  /** Charge totale (m ou ft selon les unités). */
  head: number;
  pattern?: string;
}

export interface Tank extends BaseNode {
  type: 'tank';
  elevation: number;
  initLevel: number;
  minLevel: number;
  maxLevel: number;
  diameter: number;
  minVolume?: number;
  /** Référence vers une courbe volume (niveau → volume) de la bibliothèque. */
  volumeCurve?: string;
}

export type NetworkNode = Junction | Reservoir | Tank;

export interface BaseLink {
  id: string;
  type: LinkType;
  node1: string;
  node2: string;
  /** Sommets intermédiaires pour le tracé (espace modèle). */
  vertices?: { x: number; y: number }[];
  label?: string;
}

export interface Pipe extends BaseLink {
  type: 'pipe';
  length: number;
  /** Diamètre INTÉRIEUR (mm) — utilisé pour l'hydraulique. */
  diameter: number;
  /** Coefficient de rugosité (selon la formule de perte de charge). */
  roughness: number;
  minorLoss: number;
  status: LinkStatus;
  // --- Référence catalogue (optionnelle) ---
  /** Identifiant du matériau catalogue (ex. PEHD PE100). */
  material?: string;
  /** Diamètre extérieur nominal (DN, mm). */
  dn?: number;
  /** Pression nominale (PN, bar). */
  pn?: number;
}

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export interface Pump extends BaseLink {
  type: 'pump';
  mode: PumpMode;
  /** Puissance constante (kW) si mode = 'power'. */
  power?: number;
  /** Point nominal (débit, hauteur) si mode = 'head' sans courbe détaillée. */
  designFlow?: number;
  designHead?: number;
  /** Courbe caractéristique multi-points (prioritaire sur designFlow/Head si renseignée). */
  curve?: PumpCurvePoint[];
  status: LinkStatus;
  speed?: number;
  /** Référence vers une courbe caractéristique de la bibliothèque (prioritaire). */
  headCurve?: string;
  /** Référence vers une courbe de rendement de la bibliothèque. */
  efficiencyCurve?: string;
  /** Courbe de modulation de la vitesse (motif appliqué à la vitesse au fil du temps). */
  speedPattern?: string;
  /** Rendement constant (%). */
  efficiency?: number;
  /** Prix de l'énergie (par kWh). */
  energyPrice?: number;
  /** Courbe de modulation du prix de l'énergie. */
  pricePattern?: string;
}

export interface Valve extends BaseLink {
  type: 'valve';
  valveKind: ValveKind;
  diameter: number;
  /** Consigne : pression (PRV/PSV/PBV), débit (FCV) ou coeff (TCV). */
  setting: number;
  minorLoss: number;
}

export type NetworkLink = Pipe | Pump | Valve;

export type FlowUnit = 'LPS' | 'LPM' | 'MLD' | 'CMH' | 'CMD' | 'GPM' | 'CFS';
export type HeadlossFormula = 'H-W' | 'D-W' | 'C-M';

export interface NetworkOptions {
  flowUnits: FlowUnit;
  headlossFormula: HeadlossFormula;
  /** Durée totale de la simulation en secondes (0 = régime permanent). */
  duration: number;
  /** Pas de temps hydraulique en secondes. */
  hydraulicStep: number;
  /** Pas de temps des rapports en secondes. */
  reportStep: number;
  specificGravity: number;
  viscosity: number;
  trials: number;
  accuracy: number;
}

export interface Pattern {
  id: string;
  multipliers: number[];
}

export type CurveType = 'PUMP' | 'EFFICIENCY' | 'VOLUME' | 'HEADLOSS';

export interface CurvePoint {
  x: number;
  y: number;
}

/** Courbe nommée de la bibliothèque (caractéristique, rendement, volume, perte de charge). */
export interface Curve {
  id: string;
  type: CurveType;
  description?: string;
  points: CurvePoint[];
}

export const CURVE_TYPE_LABELS: Record<CurveType, string> = {
  PUMP: 'Caractéristique (débit → hauteur)',
  EFFICIENCY: 'Rendement (débit → %)',
  VOLUME: 'Volume (niveau → volume)',
  HEADLOSS: 'Perte de charge (débit → perte)',
};

/** Contrôle simple : agit sur un lien selon le niveau d'un nœud ou l'heure. */
export interface SimpleControl {
  id: string;
  /** Lien piloté (pompe ou vanne, voire conduite). */
  linkId: string;
  /** État/consigne appliqué : OPEN, CLOSED, ou valeur numérique (vitesse/consigne). */
  setting: 'OPEN' | 'CLOSED' | number;
  /** Type de condition. */
  conditionType: 'node-level' | 'time';
  /** Nœud surveillé (si node-level). */
  nodeId?: string;
  /** Sens de comparaison (si node-level). */
  operator?: 'above' | 'below';
  /** Niveau/pression seuil (node-level) ou heure en h (time). */
  value: number;
}

/** Critères de conformité réglementaire pour l'évaluation des résultats. */
export interface ComplianceCriteria {
  /** Pression de service minimale (dans l'unité de pression du modèle). */
  minPressure: number;
  /** Pression maximale admissible. */
  maxPressure: number;
  /** Vitesse maximale admissible dans les conduites. */
  maxVelocity: number;
  /** Vitesse minimale recommandée (auto-curage), 0 pour désactiver. */
  minVelocity: number;
}

export const DEFAULT_CRITERIA: ComplianceCriteria = {
  minPressure: 20,
  maxPressure: 60,
  maxVelocity: 1.5,
  minVelocity: 0.3,
};

export interface ProjectMeta {
  name: string;
  author?: string;
  description?: string;
  createdAt: string;
}

export interface Network {
  meta: ProjectMeta;
  nodes: Record<string, NetworkNode>;
  links: Record<string, NetworkLink>;
  patterns: Record<string, Pattern>;
  curves: Record<string, Curve>;
  options: NetworkOptions;
  criteria: ComplianceCriteria;
  controls: SimpleControl[];
}

// --- Résultats de simulation ---

export interface NodeResultSeries {
  pressure: number[];
  head: number[];
  demand: number[];
  quality?: number[];
}

export interface LinkResultSeries {
  flow: number[];
  velocity: number[];
  headloss: number[];
  status: number[];
}

export interface SimulationResults {
  /** Temps de report en secondes. */
  times: number[];
  nodes: Record<string, NodeResultSeries>;
  links: Record<string, LinkResultSeries>;
  warnings: string[];
  ranAt: string;
  flowUnits: FlowUnit;
  /** Unité de longueur dérivée des unités de débit (m ou ft). */
  lengthUnit: 'm' | 'ft';
  pressureUnit: 'm' | 'psi';
}

export const DEFAULT_OPTIONS: NetworkOptions = {
  flowUnits: 'LPS',
  headlossFormula: 'H-W',
  duration: 24 * 3600,
  hydraulicStep: 3600,
  reportStep: 3600,
  specificGravity: 1.0,
  viscosity: 1.0,
  trials: 40,
  accuracy: 0.001,
};

/** Unités impériales -> longueur en ft / pression en psi. */
export function isUSUnits(units: FlowUnit): boolean {
  return units === 'GPM' || units === 'CFS';
}
