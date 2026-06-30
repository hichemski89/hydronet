/**
 * Calcule les hashes SHA-256 de tous les fichiers JS/CSS/HTML du bundle Vite
 * et les écrit dans electron/integrity.cjs.
 * Doit être exécuté après `vite build`, avant le packaging Electron.
 * Usage : node scripts/gen-integrity.mjs
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir   = join(__dirname, '..', 'dist');
const outFile   = join(__dirname, '..', 'electron', 'integrity.cjs');

// Extensions à surveiller (le cœur de l'application)
const WATCHED_EXTS = new Set(['.js', '.css', '.html']);

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function walk(dir, acc = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (WATCHED_EXTS.has(extname(name).toLowerCase())) {
      const rel = relative(distDir, full).replace(/\\/g, '/');
      acc[rel] = sha256(full);
    }
  }
  return acc;
}

const hashes  = walk(distDir);
const count   = Object.keys(hashes).length;

const content = `// Généré automatiquement par scripts/gen-integrity.mjs — NE PAS MODIFIER.
// Toute modification manuelle rendra l'application non démarrable.
'use strict';
module.exports = ${JSON.stringify(hashes, null, 2)};
`;

writeFileSync(outFile, content, 'utf8');
console.log(`[gen-integrity] ${count} fichier(s) indexés → electron/integrity.cjs`);
