import { Network, DEFAULT_CRITERIA } from '../types/network';

const FORMAT = 'hydronet-project';
const VERSION = 1;

interface ProjectFile {
  format: string;
  version: number;
  network: Network;
}

/**
 * Enregistre le réseau au format projet .hydronet.
 * Utilise la boîte native « Enregistrer sous » (choix du dossier) quand le
 * navigateur/Electron le permet (File System Access API), sinon téléchargement.
 * Renvoie true si enregistré, false si l'utilisateur a annulé.
 */
export async function saveProjectFile(network: Network): Promise<boolean> {
  const data: ProjectFile = { format: FORMAT, version: VERSION, network };
  const json = JSON.stringify(data, null, 2);
  return saveTextFile(json, `${safeName(network.meta.name)}.hydronet`, {
    mime: 'application/json',
    description: 'Projet HydroNet',
    ext: '.hydronet',
  });
}

interface SaveOpts {
  mime: string;
  description: string;
  ext: string;
}

/** Enregistre un texte avec choix du dossier si possible, sinon téléchargement. */
export async function saveTextFile(text: string, filename: string, opts: SaveOpts): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemWritableHandle> })
    .showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: opts.description, accept: { [opts.mime]: [opts.ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (err) {
      // annulation par l'utilisateur -> ne pas basculer sur le téléchargement
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // autre erreur -> repli téléchargement
    }
  }
  triggerDownload(new Blob([text], { type: opts.mime }), filename);
  return true;
}

interface FileSystemWritableHandle {
  createWritable: () => Promise<{ write: (data: string | Blob) => Promise<void>; close: () => Promise<void> }>;
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
