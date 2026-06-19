import { Network, DEFAULT_OPTIONS, DEFAULT_CRITERIA } from '../types/network';

const KEY = 'hydronet:autosave:v1';

/** Lit le réseau sauvegardé automatiquement dans le navigateur (ou null). */
export function loadPersistedNetwork(): Network | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const net = JSON.parse(raw) as Network;
    if (!net || !net.nodes || !net.links) return null;
    // Complète les champs éventuellement manquants (compatibilité ascendante).
    net.options = { ...DEFAULT_OPTIONS, ...net.options };
    net.criteria = { ...DEFAULT_CRITERIA, ...net.criteria };
    net.patterns ??= {};
    net.curves ??= {};
    net.controls ??= [];
    return net;
  } catch {
    return null;
  }
}

/** Enregistre le réseau dans le navigateur (silencieux en cas d'échec). */
export function savePersistedNetwork(network: Network): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(network));
  } catch {
    /* quota dépassé ou stockage indisponible : ignoré */
  }
}

export function clearPersistedNetwork(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}

const KEY_DISPLAY = 'hydronet:display:v1';

/** Réglages d'affichage persistés (ou null). Typé librement pour éviter le couplage. */
export function loadPersistedDisplay<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY_DISPLAY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function savePersistedDisplay(display: unknown): void {
  try {
    localStorage.setItem(KEY_DISPLAY, JSON.stringify(display));
  } catch {
    /* ignoré */
  }
}

const KEY_CAD = 'hydronet:cad:v1';

/** Fond de plan + réglages d'échelle persistés (best-effort ; peut échouer si volumineux). */
export function loadPersistedCad<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY_CAD);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function savePersistedCad(data: unknown): void {
  try {
    localStorage.setItem(KEY_CAD, JSON.stringify(data));
  } catch {
    /* fond de plan trop volumineux pour le stockage : ignoré */
  }
}

const KEY_RECENTS = 'hydronet:recents:v1';

export function loadRecents<T>(): T[] {
  try {
    const raw = localStorage.getItem(KEY_RECENTS);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function saveRecents(data: unknown): void {
  try {
    localStorage.setItem(KEY_RECENTS, JSON.stringify(data));
  } catch {
    /* ignoré */
  }
}
