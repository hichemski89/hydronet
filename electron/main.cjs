// Process principal Electron — emballe l'application web sans la modifier.
// En production, on sert le dossier `dist/` via un petit serveur HTTP local
// (port fixe) afin que le chargement du WASM (epanet-js) et le localStorage
// fonctionnent exactement comme dans le navigateur.
const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEV = process.env.ELECTRON_DEV === '1';
const DEV_URL = 'http://localhost:5173';
const PROD_PORT = 51789; // port fixe -> origine stable -> localStorage conservé

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Sert le dossier dist/ ; renvoie l'URL racine une fois prêt. */
function startStaticServer() {
  const root = path.join(__dirname, '..', 'dist');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        let filePath = path.join(root, path.normalize(urlPath));
        // empêche de sortir du dossier dist
        if (!filePath.startsWith(root)) filePath = path.join(root, 'index.html');
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(root, 'index.html'); // repli SPA
        }
        const ext = path.extname(filePath).toLowerCase();
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
    },
  });

  // ouvre les liens externes dans le navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = DEV ? DEV_URL : await startStaticServer();
  await win.loadURL(url);
}

// une seule instance -> le port fixe reste libre
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

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
