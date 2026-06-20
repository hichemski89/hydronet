// Logique d'activation côté client : identifiant de poste, vérification de la
// signature Ed25519, stockage local, activation et re-vérification en ligne.
import { LICENSE } from './config';

const TOKEN_KEY = 'hydronet:license:v1';
const MACHINE_KEY = 'hydronet:machine:v1';
const LASTCHECK_KEY = 'hydronet:license:lastcheck:v1';

export interface LicensePayload {
  product: string;
  key: string;
  machineId: string;
  plan: string;
  issuedAt: number;
  recheckAfterDays: number;
}

export type LicenseState =
  | { status: 'ok'; payload: LicensePayload }
  | { status: 'none' }
  | { status: 'invalid' };

/** Identifiant de poste persistant (créé une fois, stocké localement). */
export function getMachineId(): string {
  let id = localStorage.getItem(MACHINE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 24);
    localStorage.setItem(MACHINE_KEY, id);
  }
  return id;
}

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
    const sig = b64urlToBytes(s);
    const ok = await crypto.subtle.verify(
      'Ed25519',
      await getPublicKey(),
      sig as unknown as BufferSource,
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
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { status: 'none' };
  const payload = await verifyToken(token);
  if (!payload) return { status: 'invalid' };
  if (payload.product !== LICENSE.PRODUCT) return { status: 'invalid' };
  if (payload.machineId !== getMachineId()) return { status: 'invalid' };
  return { status: 'ok', payload };
}

/** Active une clé auprès du serveur ; stocke le jeton signé en cas de succès. */
export async function activate(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${LICENSE.SERVER_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: LICENSE.PRODUCT, key: key.trim(), machineId: getMachineId() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Erreur serveur (${res.status}).` };
    const payload = await verifyToken(data.token);
    if (!payload) return { ok: false, error: 'Réponse de licence invalide (signature).' };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(LASTCHECK_KEY, String(Date.now()));
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
  const last = Number(localStorage.getItem(LASTCHECK_KEY) || payload.issuedAt);
  const dueMs = (payload.recheckAfterDays || LICENSE.RECHECK_DAYS) * 86400000;
  if (Date.now() - last < dueMs) return true; // pas encore l'heure
  try {
    const res = await fetch(`${LICENSE.SERVER_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: payload.key, machineId: payload.machineId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid === false) {
      localStorage.removeItem(TOKEN_KEY); // révoquée
      return false;
    }
    localStorage.setItem(LASTCHECK_KEY, String(Date.now()));
    return true;
  } catch {
    // hors-ligne : on tolère dans la limite de la grâce
    const graceMs = LICENSE.OFFLINE_GRACE_DAYS * 86400000;
    return Date.now() - last < dueMs + graceMs;
  }
}

export function clearLicense(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LASTCHECK_KEY);
}
