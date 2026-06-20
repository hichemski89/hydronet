// Génère une paire de clés Ed25519 pour signer les activations.
// Usage : node keygen.js
//  - LICENSE_PRIVATE_KEY  -> à mettre dans les variables d'environnement du serveur (Render)
//  - PUBLIC_KEY           -> à coller dans le client (src/license/config.ts : PUBLIC_KEY_B64)
const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('\n=== Clé PRIVÉE (serveur — variable LICENSE_PRIVATE_KEY) ===');
console.log(priv);
console.log('\n=== Clé PUBLIQUE (client — config.ts PUBLIC_KEY_B64) ===');
console.log(pub);
console.log('\nNe partagez JAMAIS la clé privée.\n');
