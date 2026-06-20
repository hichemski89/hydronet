# Serveur de licences HydroNet

Active et valide les clés de licence, et **signe** les activations (Ed25519).
Le client HydroNet vérifie la signature avec la clé publique embarquée : une
licence ne peut donc pas être falsifiée.

## 1. Générer la paire de clés
```bash
cd license-server
npm install
npm run keygen
```
- `LICENSE_PRIVATE_KEY` → variable d'environnement du serveur (ne jamais partager)
- `PUBLIC_KEY` → à coller dans le client : `src/license/config.ts` → `PUBLIC_KEY_B64`

## 2. Lancer en local (test)
```bash
# .env avec LICENSE_PRIVATE_KEY, LICENSE_KEYS=HN-TEST-0001, ADMIN_SECRET=...
npm start
# -> http://localhost:8080/health
```

## 3. Déployer sur Render
- Nouveau **Web Service** pointant sur le dossier `license-server/`.
- Build : `npm install` · Start : `npm start`
- Variables d'env : `LICENSE_PRIVATE_KEY`, `LICENSE_KEYS`, `ADMIN_SECRET`, `PRODUCT=HydroNet`
- Notez l'URL publique (ex. `https://hydronet-licenses.onrender.com`) → à mettre
  dans le client : `src/license/config.ts` → `SERVER_URL`.

## 4. Activer la vérification dans le client
Dans `src/license/config.ts` :
```ts
ENABLED: true,
SERVER_URL: 'https://VOTRE-serveur.onrender.com',
PUBLIC_KEY_B64: 'VOTRE_CLE_PUBLIQUE',
```

## Endpoints
- `POST /activate` `{ product, key, machineId }` → `{ token }` (jeton signé)
- `POST /validate` `{ key, machineId }` → `{ valid }`
- `POST /admin/keys` (en-tête `x-admin-secret`) → crée une clé `{ key }`
- `POST /admin/revoke` `{ key }` → révoque
- `POST /admin/unbind` `{ key }` → libère la liaison (transfert de poste)

## ⚠️ Production
Les liaisons clé↔poste et les clés créées via `/admin` sont **en mémoire**
(perdues au redémarrage). Pour la production, branchez une base de données
(Render Postgres, Upstash Redis…). Les clés listées dans `LICENSE_KEYS`
restent toujours valides.
