/*
 * Serveur de licences HydroNet — © 2026 NovaSoft.
 * Active et valide les clés de licence ; signe les activations en Ed25519
 * (le client vérifie la signature avec la clé publique embarquée).
 *
 * Variables d'environnement :
 *  - LICENSE_PRIVATE_KEY : clé privée Ed25519 (base64 PKCS8) — voir keygen.js
 *  - LICENSE_KEYS        : clés valides « 1 clé = 1 poste » (séparées par des virgules)
 *  - LICENSE_KEYS_MULTI  : clés démo multi-postes (séparées par des virgules)
 *  - ADMIN_SECRET        : secret pour créer/révoquer des clés
 *  - PRODUCT             : nom du produit (défaut "HydroNet")
 *  - PORT                : port d'écoute (fourni par Render)
 *
 *  Persistance (recommandée en production) — Upstash Redis (REST) :
 *  - UPSTASH_REDIS_REST_URL
 *  - UPSTASH_REDIS_REST_TOKEN
 *  Sans ces variables, le stockage est en mémoire (perdu au redémarrage).
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

const parseKeys = (v) =>
  new Set((v || '').split(',').map((k) => k.trim().toUpperCase()).filter(Boolean));

const seededKeys = parseKeys(process.env.LICENSE_KEYS); // 1 clé = 1 poste
const multiKeys = parseKeys(process.env.LICENSE_KEYS_MULTI); // démo : multi-postes
const isMulti = (key) => multiKeys.has(key);

// ---------- Couche de stockage (Redis Upstash, sinon mémoire) ----------
function memoryStore() {
  const bind = new Map();
  const revoked = new Set();
  const created = new Set();
  return {
    kind: 'mémoire',
    getBinding: (k) => bind.get(k) ?? null,
    setBinding: (k, m) => void bind.set(k, m),
    delBinding: (k) => void bind.delete(k),
    isRevoked: (k) => revoked.has(k),
    revoke: (k) => void revoked.add(k),
    isCreated: (k) => created.has(k),
    addCreated: (k) => void created.add(k),
  };
}

function redisStore(url, token) {
  const cmd = async (...args) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error(`Redis ${r.status}`);
    const d = await r.json();
    return d.result;
  };
  return {
    kind: 'Upstash Redis',
    getBinding: (k) => cmd('GET', `bind:${k}`),
    setBinding: (k, m) => cmd('SET', `bind:${k}`, m),
    delBinding: (k) => cmd('DEL', `bind:${k}`),
    isRevoked: async (k) => (await cmd('SISMEMBER', 'revoked', k)) === 1,
    revoke: (k) => cmd('SADD', 'revoked', k),
    isCreated: async (k) => (await cmd('SISMEMBER', 'created', k)) === 1,
    addCreated: (k) => cmd('SADD', 'created', k),
  };
}

const store =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? redisStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : memoryStore();

async function isValidKey(K) {
  if (await store.isRevoked(K)) return false;
  if (seededKeys.has(K) || multiKeys.has(K)) return true;
  return store.isCreated(K);
}

// ---------- Signature ----------
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

// ---------- API ----------
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Erreur serveur.' });
});

app.get('/', (_req, res) =>
  res.type('text').send(`Serveur de licences ${PRODUCT} — en ligne. Endpoints : /health, /activate, /validate.`),
);
app.get('/health', (_req, res) => res.json({ ok: true, product: PRODUCT, storage: store.kind }));

// Activation : lie la clé au poste et renvoie un jeton signé.
app.post('/activate', wrap(async (req, res) => {
  const { product, key, machineId } = req.body || {};
  if (product !== PRODUCT) return res.status(400).json({ error: 'Produit inconnu.' });
  if (!key || !machineId) return res.status(400).json({ error: 'Clé ou identifiant manquant.' });
  const K = String(key).trim().toUpperCase();

  if (!(await isValidKey(K))) return res.status(403).json({ error: 'Clé de licence invalide.' });

  if (!isMulti(K)) {
    const bound = await store.getBinding(K);
    if (bound && bound !== machineId) {
      return res.status(409).json({ error: 'Cette clé est déjà activée sur un autre poste.' });
    }
    await store.setBinding(K, machineId);
  }
  return res.json({ token: signActivation(K, machineId) });
}));

// Re-vérification en ligne (révocation / poste).
app.post('/validate', wrap(async (req, res) => {
  const { key, machineId } = req.body || {};
  const K = String(key || '').trim().toUpperCase();
  if (!(await isValidKey(K))) return res.json({ valid: false, reason: 'revoked' });
  if (!isMulti(K)) {
    const bound = await store.getBinding(K);
    if (bound && bound !== machineId) return res.json({ valid: false, reason: 'other-machine' });
  }
  return res.json({ valid: true });
}));

// --- Administration (protégée par ADMIN_SECRET) ---
function admin(req, res, next) {
  if (!process.env.ADMIN_SECRET || req.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }
  next();
}

app.post('/admin/keys', admin, wrap(async (_req, res) => {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const key = `HN-${seg()}-${seg()}-${seg()}-${seg()}`;
  await store.addCreated(key);
  res.json({ key });
}));

app.post('/admin/revoke', admin, wrap(async (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  if (!K) return res.status(400).json({ error: 'Clé manquante.' });
  await store.revoke(K);
  await store.delBinding(K);
  res.json({ revoked: K });
}));

app.post('/admin/unbind', admin, wrap(async (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  await store.delBinding(K);
  res.json({ unbound: K });
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Serveur de licences ${PRODUCT} sur le port ${PORT} — stockage : ${store.kind}`));
