// Logique d'activation côté client : identifiant de poste (hardware via IPC),
// vérification de la signature Ed25519, stockage chiffré via safeStorage Electron.
import { LICENSE } from './config';
import type {} from '../types/electron';

export interface LicensePayload {
  product: string;
  key: string;
  machineId: string;
  plan: string;
  issuedAt: number;
  recheckAfterDays: number;
  /** Adresse e-mail du titulaire de la licence (inscrite à l'activation). */
  email?: string;
  /** Échéance (ms) pour les licences à durée limitée (démo/essai). */
  expiresAt?: number;
}

export type LicenseState =
  | { status: 'ok'; payload: LicensePayload }
  | { status: 'none' }
  | { status: 'invalid' };

// ---------- Couche de stockage : IPC Electron ou localStorage (dev web) ----------

const api = window.electronLicense;

async function storageGet(key: string): Promise<string | null> {
  if (api) {
    if (key === 'token')     return api.getToken();
    if (key === 'lastcheck') return api.getLastCheck();
    return null;
  }
  return localStorage.getItem(`hydronet:license:${key}:v1`);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (api) {
    if (key === 'token')     { await api.setToken(value); return; }
    if (key === 'lastcheck') { await api.setLastCheck(value); return; }
    return;
  }
  localStorage.setItem(`hydronet:license:${key}:v1`, value);
}

async function storageDel(key: string): Promise<void> {
  if (api) {
    if (key === 'token') { await api.clearToken(); return; }
    return;
  }
  localStorage.removeItem(`hydronet:license:${key}:v1`);
}

/** Identifiant machine : hardware via IPC (Electron) ou UUID persistant (dev). */
export async function getMachineId(): Promise<string> {
  if (api) return api.getMachineId();
  // Repli pour le dev navigateur uniquement
  const KEY = 'hydronet:machine:v1';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 24);
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ---------- Cryptographie ----------

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let publicKeyPromise: Promise<CryptoKey> | null = null;
function getPublicKey(): Promise<CryptoKey> {
  if (!publicKeyPromise) {
    publicKeyPromise = crypto.subtle.importKey(
      'spki',
      b64ToBytes(LICENSE.PUBLIC_KEY_B64) as unknown as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
  }
  return publicKeyPromise;
}

/** Vérifie la signature d'un jeton et renvoie sa charge utile, ou null. */
export async function verifyToken(token: string): Promise<LicensePayload | null> {
  try {
    const [p, s] = token.split('.');
    if (!p || !s) return null;
    const data = b64urlToBytes(p);
    const sig  = b64urlToBytes(s);
    const ok   = await crypto.subtle.verify(
      'Ed25519',
      await getPublicKey(),
      sig  as unknown as BufferSource,
      data as unknown as BufferSource,
    );
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(data)) as LicensePayload;
  } catch {
    return null;
  }
}

/** Évalue la licence stockée (signature + produit + poste). */
export async function checkStoredLicense(): Promise<LicenseState> {
  const token = await storageGet('token');
  if (!token) return { status: 'none' };

  const payload = await verifyToken(token);
  if (!payload) return { status: 'invalid' };
  if (payload.product !== LICENSE.PRODUCT) return { status: 'invalid' };

  const machineId = await getMachineId();
  if (payload.machineId !== machineId) return { status: 'invalid' };

  // Détection de manipulation de l'horloge système (horloge avant la délivrance)
  if (Date.now() < payload.issuedAt - 300_000) return { status: 'invalid' };

  // Licence à durée limitée expirée
  if (payload.expiresAt && Date.now() > payload.expiresAt) return { status: 'invalid' };

  return { status: 'ok', payload };
}

/** Active une clé auprès du serveur ; stocke le jeton signé en cas de succès. */
export async function activate(
  key: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const machineId = await getMachineId();
    const res = await fetch(`${LICENSE.SERVER_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: LICENSE.PRODUCT,
        key: key.trim(),
        email: email.trim().toLowerCase(),
        machineId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Erreur serveur (${res.status}).` };
    const payload = await verifyToken(data.token);
    if (!payload) return { ok: false, error: 'Réponse de licence invalide (signature).' };
    await storageSet('token', data.token);
    await storageSet('lastcheck', String(Date.now()));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Serveur de licences injoignable. Vérifiez votre connexion.' };
  }
}

/**
 * Re-vérification en ligne si le délai est dépassé. Tolérante hors-ligne.
 * Renvoie false uniquement si le serveur confirme que la licence n'est plus valide.
 */
export async function revalidateIfDue(payload: LicensePayload): Promise<boolean> {
  const lastRaw = await storageGet('lastcheck');
  const last    = Number(lastRaw || payload.issuedAt);
  const dueMs   = (payload.recheckAfterDays || LICENSE.RECHECK_DAYS) * 86_400_000;
  if (Date.now() - last < dueMs) return true;
  try {
    const res = await fetch(`${LICENSE.SERVER_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: payload.key, machineId: payload.machineId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid === false) {
      await storageDel('token');
      return false;
    }
    await storageSet('lastcheck', String(Date.now()));
    return true;
  } catch {
    // Hors-ligne : tolérance dans la limite de la grâce
    const graceMs = LICENSE.OFFLINE_GRACE_DAYS * 86_400_000;
    return Date.now() - last < dueMs + graceMs;
  }
}

/** Renvoie la charge utile de la licence stockée (titulaire, clé…), ou null. */
export async function getLicenseInfo(): Promise<LicensePayload | null> {
  const token = await storageGet('token');
  if (!token) return null;
  return verifyToken(token);
}

export async function clearLicense(): Promise<void> {
  await storageDel('token');
  await storageDel('lastcheck');
}
