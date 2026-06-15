import { Network, DEFAULT_CRITERIA } from '../types/network';

const FORMAT = 'hydronet-project';
const VERSION = 1;

interface ProjectFile {
  format: string;
  version: number;
  network: Network;
}

/** Télécharge le réseau courant sous forme de fichier projet .hydronet (JSON). */
export function saveProjectFile(network: Network): void {
  const data: ProjectFile = { format: FORMAT, version: VERSION, network };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${safeName(network.meta.name)}.hydronet`);
}

/** Analyse le contenu d'un fichier projet .hydronet et renvoie le réseau. */
export function parseProjectFile(text: string): Network {
  const data = JSON.parse(text) as Partial<ProjectFile>;
  if (data.format !== FORMAT || !data.network) {
    throw new Error('Fichier projet invalide ou non reconnu.');
  }
  const net = data.network;
  if (!net.nodes || !net.links || !net.options) {
    throw new Error('Le fichier projet est incomplet.');
  }
  // Garantit la présence des champs facultatifs (compatibilité ascendante).
  net.patterns ??= {};
  net.criteria ??= { ...DEFAULT_CRITERIA };
  net.meta ??= { name: 'Projet importé', createdAt: new Date().toISOString() };
  return net as Network;
}

function safeName(name: string): string {
  return (name || 'reseau').replace(/[^\w\-]+/g, '_');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lit un fichier sélectionné par l'utilisateur en texte. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
