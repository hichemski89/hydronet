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
const crypto  = require('crypto');

const PRODUCT     = process.env.PRODUCT || 'HydroNet';
const RECHECK_DAYS = 30;
const DEMO_DAYS   = Number(process.env.DEMO_DAYS || 3);

// Origines autorisées : app Electron en prod + Vite en dev
const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:51789',
  'http://localhost:5173',
]);

const MAX_KEY_LEN     = 64;
const MAX_MACHINE_LEN = 128;
const MAX_EMAIL_LEN   = 254;
// Validation d'email simple mais suffisante (un @, un domaine avec point).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();

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

const seededKeys = parseKeys(process.env.LICENSE_KEYS);
const multiKeys  = parseKeys(process.env.LICENSE_KEYS_MULTI);
const isMulti    = (key) => multiKeys.has(key);

// ---------- Couche de stockage (Redis Upstash, sinon mémoire) ----------
function memoryStore() {
  const bind    = new Map();
  const revoked = new Set();
  const created = new Set();
  const demo    = new Map();
  const emails  = new Map(); // clé -> email
  const byEmail = new Map(); // email -> Set(clés)
  return {
    kind:          'mémoire',
    getBinding:    (k)      => bind.get(k) ?? null,
    setBinding:    (k, m)   => void bind.set(k, m),
    delBinding:    (k)      => void bind.delete(k),
    isRevoked:     (k)      => revoked.has(k),
    revoke:        (k)      => void revoked.add(k),
    listRevoked:   ()       => [...revoked],
    isCreated:     (k)      => created.has(k),
    addCreated:    (k)      => void created.add(k),
    listCreated:   ()       => [...created],
    getDemoStart:  (k, m)   => demo.get(`${k}|${m}`) ?? null,
    setDemoStart:  (k, m, t) => void demo.set(`${k}|${m}`, t),
    getEmail:      (k)      => emails.get(k) ?? null,
    setEmail:      (k, e)   => {
      emails.set(k, e);
      if (!byEmail.has(e)) byEmail.set(e, new Set());
      byEmail.get(e).add(k);
    },
    getKeysByEmail: (e)     => [...(byEmail.get(e) ?? [])],
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
    kind:          'Upstash Redis',
    getBinding:    (k)       => cmd('GET', `bind:${k}`),
    setBinding:    (k, m)    => cmd('SET', `bind:${k}`, m),
    delBinding:    (k)       => cmd('DEL', `bind:${k}`),
    isRevoked:     async (k) => (await cmd('SISMEMBER', 'revoked', k)) === 1,
    revoke:        (k)       => cmd('SADD', 'revoked', k),
    listRevoked:   ()        => cmd('SMEMBERS', 'revoked'),
    isCreated:     async (k) => (await cmd('SISMEMBER', 'created', k)) === 1,
    addCreated:    (k)       => cmd('SADD', 'created', k),
    listCreated:   ()        => cmd('SMEMBERS', 'created'),
    getDemoStart:  (k, m)    => cmd('GET', `demo:${k}:${m}`),
    setDemoStart:  (k, m, t) => cmd('SET', `demo:${k}:${m}`, String(t)),
    getEmail:      (k)       => cmd('GET', `email:${k}`),
    setEmail:      async (k, e) => {
      await cmd('SET', `email:${k}`, e);
      await cmd('SADD', `emailkeys:${e}`, k);
    },
    getKeysByEmail: (e)      => cmd('SMEMBERS', `emailkeys:${e}`),
  };
}

const store =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? redisStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : memoryStore();

if (store.kind === 'mémoire') {
  console.warn(
    '[AVERTISSEMENT] Stockage en mémoire — les liaisons et révocations seront perdues au redémarrage.\n' +
    '                Configurez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN en production.',
  );
}

async function isValidKey(K) {
  if (await store.isRevoked(K)) return false;
  if (seededKeys.has(K) || multiKeys.has(K)) return true;
  return store.isCreated(K);
}

// ---------- Signature ----------
function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signActivation(key, machineId, expiresAt, email) {
  const payload = {
    product: PRODUCT,
    key,
    machineId,
    plan: expiresAt ? 'demo' : 'perpetual',
    issuedAt: Date.now(),
    recheckAfterDays: RECHECK_DAYS,
    ...(email ? { email } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig  = crypto.sign(null, data, PRIVATE_KEY);
  return b64url(data) + '.' + b64url(sig);
}

// ---------- Rate limiting (sans dépendance externe) ----------
// windowMs : fenêtre de temps, max : nombre de requêtes autorisées par IP
function createRateLimiter(max, windowMs) {
  const counts = new Map(); // ip -> { n: number, resetAt: number }
  // Nettoyage périodique pour éviter les fuites mémoire
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of counts) {
      if (now > entry.resetAt) counts.delete(ip);
    }
  }, windowMs);

  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = counts.get(ip);
    if (!entry || now > entry.resetAt) {
      counts.set(ip, { n: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.n >= max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
    }
    entry.n++;
    next();
  };
}

const activateLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10 / 15 min par IP
const validateLimiter = createRateLimiter(60, 15 * 60 * 1000); // 60 / 15 min par IP

// ---------- Vérification du secret admin (constant-time) ----------
function checkAdminSecret(provided) {
  if (!process.env.ADMIN_SECRET) return false;
  try {
    // On hache les deux pour obtenir des buffers de longueur égale (nécessaire pour timingSafeEqual)
    const a = crypto.createHash('sha256').update(provided || '').digest();
    const b = crypto.createHash('sha256').update(process.env.ADMIN_SECRET).digest();
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------- API ----------
const app = express();
app.set('trust proxy', 1); // pour récupérer l'IP réelle derrière Render
app.use(express.json({ limit: '4kb' }));

// CORS restrictif : seules les origines Electron connues sont autorisées
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur.' });
  });

app.get('/', (_req, res) =>
  res.type('text').send(`Serveur de licences ${PRODUCT} — en ligne. Endpoints : /health, /activate, /validate.`),
);
app.get('/health', (_req, res) => res.json({ ok: true, product: PRODUCT, storage: store.kind }));

// Activation : lie la clé au poste et renvoie un jeton signé.
app.post('/activate', activateLimiter, wrap(async (req, res) => {
  const { product, key, machineId } = req.body || {};
  if (product !== PRODUCT) return res.status(400).json({ error: 'Produit inconnu.' });

  if (!key || typeof key !== 'string' || key.length > MAX_KEY_LEN)
    return res.status(400).json({ error: 'Clé invalide.' });
  if (!machineId || typeof machineId !== 'string' || machineId.length > MAX_MACHINE_LEN)
    return res.status(400).json({ error: 'Identifiant machine invalide.' });

  const email = normEmail(req.body?.email);
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });

  const K = key.trim().toUpperCase();
  if (!(await isValidKey(K))) return res.status(403).json({ error: 'Clé de licence invalide.' });

  // Clé démo : multi-postes mais limitée dans le temps par poste.
  if (isMulti(K)) {
    let first = Number(await store.getDemoStart(K, machineId)) || 0;
    if (!first) {
      first = Date.now();
      await store.setDemoStart(K, machineId, first);
    }
    const expiresAt = first + DEMO_DAYS * 86_400_000;
    if (Date.now() > expiresAt)
      return res.status(403).json({ error: `Période d'essai de ${DEMO_DAYS} jours terminée.` });
    await store.setEmail(K, email);
    return res.json({ token: signActivation(K, machineId, expiresAt, email) });
  }

  // Clé client : 1 poste, lié à un e-mail. Si la clé a déjà un titulaire,
  // l'e-mail doit correspondre (empêche le détournement d'une clé d'autrui).
  const owner = await store.getEmail(K);
  if (owner && owner !== email)
    return res.status(409).json({ error: 'Cette clé est enregistrée à une autre adresse e-mail.' });

  const bound = await store.getBinding(K);
  if (bound && bound !== machineId)
    return res.status(409).json({ error: 'Cette clé est déjà activée sur un autre poste.' });
  await store.setBinding(K, machineId);
  await store.setEmail(K, email);
  return res.json({ token: signActivation(K, machineId, undefined, email) });
}));

// Re-vérification en ligne (révocation / poste).
app.post('/validate', validateLimiter, wrap(async (req, res) => {
  const { key, machineId } = req.body || {};

  if (!key || typeof key !== 'string' || key.length > MAX_KEY_LEN)
    return res.json({ valid: false, reason: 'invalid-key' });
  if (!machineId || typeof machineId !== 'string' || machineId.length > MAX_MACHINE_LEN)
    return res.json({ valid: false, reason: 'invalid-machine' });

  const K = key.trim().toUpperCase();
  if (!(await isValidKey(K))) return res.json({ valid: false, reason: 'revoked' });

  if (isMulti(K)) {
    const first = Number(await store.getDemoStart(K, machineId)) || 0;
    if (first && Date.now() > first + DEMO_DAYS * 86_400_000)
      return res.json({ valid: false, reason: 'expired' });
    return res.json({ valid: true });
  }

  const bound = await store.getBinding(K);
  if (bound && bound !== machineId) return res.json({ valid: false, reason: 'other-machine' });
  return res.json({ valid: true });
}));

// --- Administration (protégée par ADMIN_SECRET en comparaison constant-time) ---
function admin(req, res, next) {
  if (!checkAdminSecret(req.get('x-admin-secret'))) {
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
  if (!K || K.length > MAX_KEY_LEN) return res.status(400).json({ error: 'Clé manquante ou invalide.' });
  await store.revoke(K);
  await store.delBinding(K);
  res.json({ revoked: K });
}));

app.post('/admin/unbind', admin, wrap(async (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  if (!K || K.length > MAX_KEY_LEN) return res.status(400).json({ error: 'Clé manquante ou invalide.' });
  await store.delBinding(K);
  res.json({ unbound: K });
}));

// Recherche d'une clé : titulaire (e-mail), poste lié, état de révocation.
app.post('/admin/lookup', admin, wrap(async (req, res) => {
  const K = String(req.body?.key || '').trim().toUpperCase();
  if (!K || K.length > MAX_KEY_LEN) return res.status(400).json({ error: 'Clé manquante ou invalide.' });
  res.json({
    key:       K,
    email:     await store.getEmail(K),
    machineId: await store.getBinding(K),
    revoked:   await store.isRevoked(K),
  });
}));

// Recherche des clés associées à une adresse e-mail (support client).
app.post('/admin/by-email', admin, wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  res.json({ email, keys: (await store.getKeysByEmail(email)) || [] });
}));

// Inventaire complet des clés : générées (Redis), pré-définies (env), démo, révoquées.
app.post('/admin/list', admin, wrap(async (_req, res) => {
  const created = (await store.listCreated()) || [];
  const revoked = (await store.listRevoked()) || [];
  res.json({
    counts: {
      created: created.length,
      seeded:  seededKeys.size,
      multi:   multiKeys.size,
      revoked: revoked.length,
      total:   created.length + seededKeys.size + multiKeys.size,
    },
    created,
    seeded: [...seededKeys],
    multi:  [...multiKeys],
    revoked,
  });
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`Serveur de licences ${PRODUCT} sur le port ${PORT} — stockage : ${store.kind}`),
);
