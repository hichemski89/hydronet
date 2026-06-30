/*
 * HydroNet — © 2026 NovaSoft — Tous droits réservés. Logiciel propriétaire.
 * Toute copie, distribution ou ingénierie inverse non autorisée est interdite.
 */
// Process principal Electron — emballe l'application web sans la modifier.
// En production, on sert le dossier `dist/` via un petit serveur HTTP local
// (port fixe) afin que le chargement du WASM (epanet-js) fonctionne correctement.
const { app, BrowserWindow, shell, ipcMain, safeStorage, dialog } = require('electron');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

app.setName('HydroNet');

const DEV      = process.env.ELECTRON_DEV === '1';
const DEV_URL  = 'http://localhost:5173';
const PROD_PORT = 51789;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

// ---------- Vérification d'intégrité du bundle ----------
// Bloque le démarrage si un fichier JS/CSS/HTML a été modifié après le build.
function verifyIntegrity() {
  if (DEV) return true; // ignoré en mode développement
  try {
    const INTEGRITY = require('./integrity.cjs');
    const root = path.join(__dirname, '..', 'dist');
    for (const [rel, expected] of Object.entries(INTEGRITY)) {
      const filePath = path.join(root, rel);
      if (!fs.existsSync(filePath)) {
        console.error(`[integrity] Fichier manquant : ${rel}`);
        return false;
      }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      if (actual !== expected) {
        console.error(`[integrity] Fichier modifié : ${rel}`);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[integrity] Erreur :', e.message);
    return false;
  }
}

// ---------- Blocage des DevTools en production ----------
function lockdownDevTools(win) {
  if (DEV) return;

  // Ferme les DevTools s'ils sont ouverts par un autre moyen
  win.webContents.on('devtools-opened', () => {
    win.webContents.closeDevTools();
  });

  // Bloque les raccourcis clavier ouvrant les DevTools
  win.webContents.on('before-input-event', (event, input) => {
    const ctrl  = input.control || input.meta;
    const shift = input.shift;
    if (
      input.key === 'F12' ||
      (ctrl && shift && input.key === 'I') ||
      (ctrl && shift && input.key === 'J') ||
      (ctrl && shift && input.key === 'C')
    ) {
      event.preventDefault();
    }
  });
}

// Intercepte aussi toute fenêtre secondaire créée par l'app
app.on('web-contents-created', (_e, contents) => {
  if (!DEV) {
    contents.on('devtools-opened', () => contents.closeDevTools());
  }
});

// ---------- Chemins de stockage sécurisé ----------
const userData     = app.getPath('userData');
const LICENSE_FILE = path.join(userData, 'hn_lic.dat');
const MACHINE_FILE = path.join(userData, 'hn_mid.dat');
const CHECK_FILE   = path.join(userData, 'hn_chk.dat');

// ---------- Chiffrement via safeStorage (OS keychain) ----------
function readEncrypted(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (!safeStorage.isEncryptionAvailable()) return buf.toString('utf8');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

function writeEncrypted(filePath, value) {
  if (!safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(filePath, value, 'utf8');
    return;
  }
  fs.writeFileSync(filePath, safeStorage.encryptString(value));
}

// ---------- Identifiant machine basé sur le hardware ----------
// IMPORTANT : l'identifiant doit être STABLE et INDÉPENDANT du réseau. Utiliser
// les adresses MAC est piégeux : couper le Wi-Fi/Ethernet fait disparaître les
// cartes -> l'identifiant changerait -> la licence serait redemandée hors ligne.
// On utilise donc le MachineGuid de Windows (registre), avec repli CPU + hôte.
function deriveHardwareMachineId() {
  let seed = '';
  try {
    if (process.platform === 'win32') {
      const out = require('child_process')
        .execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
          windowsHide: true,
          timeout: 3000,
        })
        .toString();
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
      if (m) seed = m[1];
    }
  } catch {
    /* registre inaccessible : repli ci-dessous */
  }
  if (!seed) {
    // Repli stable, sans dépendre du réseau : modèle CPU + nom du poste.
    const cpuModel = (os.cpus()[0] || {}).model || '';
    seed = `${cpuModel}::${os.hostname()}`;
  }
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

// Récupère l'identifiant de poste inscrit dans le jeton de licence déjà stocké.
// Permet de conserver une activation existante après un changement d'algorithme
// (le jeton étant signé, son machineId est forcément légitime).
function machineIdFromStoredToken() {
  try {
    const token = readEncrypted(LICENSE_FILE);
    if (!token) return null;
    const p = token.split('.')[0];
    if (!p) return null;
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4);
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload.machineId === 'string' ? payload.machineId : null;
  } catch {
    return null;
  }
}

function getMachineId() {
  // 1. Valeur MÉMORISÉE en priorité (chiffrée, liée au poste par le coffre de
  //    l'OS). Une fois calculée elle ne change plus -> activation hors ligne fiable.
  const cached = readEncrypted(MACHINE_FILE);
  if (cached) return cached;
  // 2. Migration : adopter l'identifiant d'une licence déjà activée (évite de
  //    redemander la clé après une mise à jour).
  const fromToken = machineIdFromStoredToken();
  if (fromToken) {
    writeEncrypted(MACHINE_FILE, fromToken);
    return fromToken;
  }
  // 3. Première activation : calculer un identifiant stable et le mémoriser.
  let id;
  try {
    const hw = deriveHardwareMachineId();
    id = hw && hw.length >= 16 ? hw : crypto.randomUUID().replace(/-/g, '');
  } catch {
    id = crypto.randomUUID().replace(/-/g, '');
  }
  writeEncrypted(MACHINE_FILE, id);
  return id;
}

// ---------- Handlers IPC ----------
ipcMain.handle('license:getToken',     ()           => readEncrypted(LICENSE_FILE));
ipcMain.handle('license:setToken',     (_, token)   => { writeEncrypted(LICENSE_FILE, token); });
ipcMain.handle('license:clearToken',   ()           => { try { fs.unlinkSync(LICENSE_FILE); } catch {} });
ipcMain.handle('license:getMachineId', ()           => getMachineId());
ipcMain.handle('license:getLastCheck', ()           => readEncrypted(CHECK_FILE));
ipcMain.handle('license:setLastCheck', (_, ts)      => { writeEncrypted(CHECK_FILE, String(ts)); });

// ---------- Confirmation de fermeture (enregistrement) ----------
// Tant que `appClosing` est faux, la fermeture de la fenêtre est interceptée et
// déléguée au renderer (qui propose Enregistrer / Ne pas enregistrer / Annuler).
let appClosing = false;
ipcMain.on('app:confirm-close', (e) => {
  appClosing = true;
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.destroy(); // ferme sans repasser par l'événement « close »
});

// ---------- Serveur statique (production) ----------
function startStaticServer() {
  const root = path.join(__dirname, '..', 'dist');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        let filePath = path.join(root, path.normalize(urlPath));
        if (!filePath.startsWith(root)) filePath = path.join(root, 'index.html');
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(root, 'index.html');
        }
        const ext  = path.extname(filePath).toLowerCase();
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(PROD_PORT, '127.0.0.1', () => resolve(`http://127.0.0.1:${PROD_PORT}`));
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    title: 'HydroNet',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: DEV, // désactive l'API DevTools en production
    },
  });

  lockdownDevTools(win);

  // Intercepte la fermeture pour proposer d'enregistrer les modifications.
  win.on('close', (e) => {
    if (appClosing) return; // fermeture déjà confirmée
    e.preventDefault();
    win.webContents.send('app:close-request');
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = DEV ? DEV_URL : await startStaticServer();
  await win.loadURL(url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!verifyIntegrity()) {
      dialog.showErrorBox(
        'HydroNet — Intégrité compromise',
        "Les fichiers de l'application ont été modifiés ou corrompus.\n\nRéinstallez HydroNet depuis la source officielle.",
      );
      app.quit();
      return;
    }
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
