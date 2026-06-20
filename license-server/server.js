/*
 * Serveur de licences HydroNet — © 2026 NovaSoft.
 * Active et valide les clés de licence ; signe les activations en Ed25519
 * (le client vérifie la signature avec la clé publique embarquée).
 *
 * Variables d'environnement :
 *  - LICENSE_PRIVATE_KEY : clé privée Ed25519 (base64 PKCS8) — voir keygen.js
 *  - LICENSE_KEYS        : clés valides séparées par des virgules (ex. "ABCD-1234,EFGH-5678")
 *  - ADMIN_SECRET        : secret pour créer/révoquer des clés
 *  - PRODUCT             : nom du produit (défaut "HydroNet")
 *  - PORT                : port d'écoute (Render le fournit)
 *
 * ⚠️ MVP : les liaisons (clé↔poste) et les clés créées via /admin sont en
 * mémoire (perdues au redémarrage). Pour la production, branchez une base de
 * données (Postgres, Redis…). Les clés de LICENSE_KEYS restent toujours valides.
 */
const express = require('express');
const crypto = require('crypto');

const PRODUCT = process.env.PRODUCT || 'HydroNet';
const RECHECK_DAYS = 30;

if (!process.env.LICENSE_PRIVATE_KEY) {
  console.error('LICENSE_PRIVATE_KEY manquante. Lancez `npm run keygen`.');
  process.exit(1);
}
const PRIVATE_KEY = crypto.createPrivateKey({
  key: Buffer.from(process.env.LICENSE_PRIVATE_KEY, 'base64'),
  format: 'der',
  type: 'pkcs8',
});

// Clés valides (depuis l'env) + clés créées à chaud (en mémoire)
const seededKeys = new Set(
  (process.env.LICENSE_KEYS || '')
    .split(',')
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean),
);
const createdKeys = new Set();
const revoked = new Set();
const bindings = new Map(); // key -> machineId

const isValidKey = (key) =>
  !revoked.has(key) && (seededKeys.has(key) || createdKeys.has(key));

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signActivation(key, machineId) {
  const payload = {
    product: PRODUCT,
    key,
    machineId,
    plan: 'perpetual',
    issuedAt: Date.now(),
    recheckAfterDays: RECHECK_DAYS,
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign(null, data, PRIVATE_KEY);
  return b64url(data) + '.' + b64url(sig);
}

const app = express();
app.use(express.json());

// CORS (le client web appelle ce serveur depuis un autre domaine)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (_req, res) =>
  res.type('text').send(`Serveur de licences ${PRODUCT} — en ligne. Endpoints : /health, /activate, /validate.`),
);

app.get('/health', (_req, res) => res.json({ ok: true, product: PRODUCT }));

// Activation : lie la clé au poste et renvoie un jeton signé.
app.post('/activate', (req, res) => {
  const { product, key, machineId } = req.body || {};
  if (product !== PRODUCT) return res.status(400).json({ error: 'Produit inconnu.' });
  if (!key || !machineId) return res.status(400).json({ error: 'Clé ou identifiant manquant.' });
  const K = String(key).trim().toUpperCase();

  if (!isValidKey(K)) return res.status(403).json({ error: 'Clé de licence invalide.' });

  const bound = bindings.get(K);
  if (bound && bound !== machineId) {
    return res.status(409).json({ error: 'Cette clé est déjà activée sur un autre poste.' });
  }
  bindings.set(K, machineId);
  return res.json({ token: signActivation(K, machineId) });
});

// Re-vérification en ligne (révocation / poste).
app.post('/validate', (req, res) => {
  const { key, machineId } = req.body || {};
  const K = String(key || '').trim().toUpperCase();
  if (!isValidKey(K)) return res.json({ valid: false, reason: 'revoked' });
  const bound = bindings.get(K);
  if (bound && bound !== machineId) return res.json({ valid: false, reason: 'other-machine' });
  return res.json({ valid: true });
});

// --- Administration (protégée par ADMIN_SECRET) ---
function admin(req, res, next) {
  if (!process.env.ADMIN_SECRET || req.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }
  next();
}

// Crée une nouvelle clé (à appeler après un paiement).
app.post('/admin/keys', admin, (_req, res) => {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const key = `HN-${seg()}-${seg()}-${seg()}-${seg()}`;
  createdKeys.add(key);
  res.json({ key });
});

app.post('/admin/revoke', admin, (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  if (!K) return res.status(400).json({ error: 'Clé manquante.' });
  revoked.add(K);
  bindings.delete(K);
  res.json({ revoked: K });
});

// Libère la liaison d'une clé (transfert vers un autre poste).
app.post('/admin/unbind', admin, (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  bindings.delete(K);
  res.json({ unbound: K });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Serveur de licences HydroNet sur le port ${PORT}`));
