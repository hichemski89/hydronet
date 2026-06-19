import { Network, DEFAULT_CRITERIA } from '../types/network';

const FORMAT = 'hydronet-project';
const VERSION = 1;

interface ProjectFile {
  format: string;
  version: number;
  network: Network;
}

interface SaveHandle {
  name: string;
  createWritable: () => Promise<{ write: (data: string | Blob) => Promise<void>; close: () => Promise<void> }>;
}

// Mémorise le fichier cible de la session pour permettre « Enregistrer » sans
// redemander le dossier (réécriture silencieuse du même fichier).
let currentHandle: SaveHandle | null = null;

/** Oublie le fichier cible (à appeler à l'ouverture d'un autre projet / nouveau). */
export function clearSaveTarget(): void {
  currentHandle = null;
}

/**
 * Enregistre le réseau au format projet .hydronet.
 * - saveAs=true (ou première fois) : boîte native « Enregistrer sous » (choix
 *   du dossier et du nom).
 * - saveAs=false avec un fichier déjà choisi : réécrit le même fichier.
 * Renvoie le nom de base du fichier réellement enregistré (sans extension),
 * ou null si l'utilisateur a annulé.
 */
export async function saveProjectFile(
  network: Network,
  opts: { saveAs?: boolean } = {},
): Promise<string | null> {
  const data: ProjectFile = { format: FORMAT, version: VERSION, network };
  const json = JSON.stringify(data, null, 2);
  const suggested = `${safeName(network.meta.name)}.hydronet`;

  const picker = (
    window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<SaveHandle> }
  ).showSaveFilePicker;

  if (picker) {
    try {
      const handle =
        !opts.saveAs && currentHandle
          ? currentHandle
          : await picker({
              suggestedName: suggested,
              types: [{ description: 'Projet HydroNet', accept: { 'application/json': ['.hydronet'] } }],
            });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      currentHandle = handle;
      return baseName(handle.name);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null; // annulé
      // autre erreur -> repli téléchargement
    }
  }
  triggerDownload(new Blob([json], { type: 'application/json' }), suggested);
  return baseName(suggested);
}

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
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
  net.curves ??= {};
  net.criteria ??= { ...DEFAULT_CRITERIA };
  net.controls ??= [];
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
