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
