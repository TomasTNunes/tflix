/* ───────────────────────────────────────────────────────────────
   TFLIX Desktop — Electron main process

   Wraps the existing TFLIX static website (../../index.html, ../../stream,
   ../../assets) in a desktop window. A tiny local HTTP server serves the
   site so that absolute paths (e.g. the "/stream" player route) and the
   __TMDB_TOKEN__ injection behave exactly like the deployed site.

   The TMDB API Read Access Token is requested on first run and stored
   in the per-user app-data folder.
   ─────────────────────────────────────────────────────────────── */

const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

/* ─── Site root (where index.html / stream / assets live) ─── */
const SITE_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'site')   // copied via extraResources
  : path.join(__dirname, '..', '..');          // dev: the repo root

/* ─── Token storage ─── */
const configPath = () => path.join(app.getPath('userData'), 'tflix.config.json');

function readToken() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    return (cfg.tmdbToken || '').trim();
  } catch {
    return '';
  }
}

function saveToken(token) {
  fs.writeFileSync(configPath(), JSON.stringify({ tmdbToken: (token || '').trim() }, null, 2), 'utf8');
}

let tmdbToken = '';
let serverPort = 0;
let mainWindow = null;

/* ─── Local static server with on-the-fly token injection ─── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

        let filePath = path.normalize(path.join(SITE_ROOT, urlPath));

        // Block path traversal outside the site root
        if (filePath !== SITE_ROOT && !filePath.startsWith(SITE_ROOT + path.sep)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }

        // Directory → its index.html  (handles the "/stream" route)
        let stat = null;
        try { stat = fs.statSync(filePath); } catch {}
        if (stat && stat.isDirectory()) filePath = path.join(filePath, 'index.html');

        if (!fs.existsSync(filePath)) {
          const notFound = path.join(SITE_ROOT, '404.html');
          if (fs.existsSync(notFound)) { filePath = notFound; res.statusCode = 404; }
          else { res.writeHead(404); res.end('Not found'); return; }
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');

        if (ext === '.html') {
          let html = fs.readFileSync(filePath, 'utf8');
          html = html.split('__TMDB_TOKEN__').join(tmdbToken);
          res.end(html);
        } else {
          fs.createReadStream(filePath).pipe(res);
        }
      } catch {
        res.writeHead(500); res.end('Server error');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
  });
}

/* ─── Window icon (only exists in dev / when generated) ─── */
function windowIcon() {
  const ico = path.join(__dirname, 'build', 'icon.ico');
  return fs.existsSync(ico) ? ico : undefined;
}

/* ─── First-run / change-token setup window ─── */
let setupOpen = false;

function openSetupWindow() {
  return new Promise((resolve) => {
    const setup = new BrowserWindow({
      width: 580,
      height: 640,
      resizable: false,
      backgroundColor: '#0a0a0d',
      autoHideMenuBar: true,
      title: 'TFLIX — Setup',
      icon: windowIcon(),
      webPreferences: {
        preload: path.join(__dirname, 'preload-setup.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    setup.setMenuBarVisibility(false);

    // The only legitimate external link (the TMDB token page) opens in the
    // user's real browser; no new Electron windows are spawned.
    setup.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });

    setup.loadFile(path.join(__dirname, 'setup.html'));

    let saved = false;

    const onSave = (_e, token) => {
      saveToken(token);
      tmdbToken = (token || '').trim();
      saved = true;
      cleanup();
      setup.close();
      resolve(true);
    };
    const onCancel = () => { cleanup(); setup.close(); resolve(false); };

    function cleanup() {
      ipcMain.removeListener('tflix:save-token', onSave);
      ipcMain.removeListener('tflix:cancel', onCancel);
    }

    ipcMain.on('tflix:save-token', onSave);
    ipcMain.on('tflix:cancel', onCancel);

    setup.on('closed', () => { cleanup(); resolve(saved); });
  });
}

/* Open setup from anywhere (menu / in-app gear button), then reload. */
async function changeTokenFlow() {
  if (setupOpen) return;
  setupOpen = true;
  try {
    const changed = await openSetupWindow();
    if (changed && mainWindow) mainWindow.reload();
  } finally {
    setupOpen = false;
  }
}

/* ─── Main app window ─── */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0a0a0d',
    autoHideMenuBar: true,
    title: 'TFLIX',
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const localOrigin = `http://127.0.0.1:${serverPort}`;

  // Block ALL pop-ups / new windows. The third-party stream embeds fire
  // popunder ads via window.open / target=_blank — denying them here means
  // no browser tab and no ad ever opens. (Sub-frames route through here too.)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Keep the top frame pinned to our local app: ad scripts sometimes try to
  // hijack the whole page via top.location = adURL. Allow only local nav.
  //
  // IMPORTANT: only guard the MAIN frame. These events also fire for the
  // third-party stream <iframe>s, which legitimately navigate and (server-side)
  // redirect cross-origin to load their players. Blocking those left the embeds
  // black (Xayah/Ekko) or on the host's own 500 page (Naafiri).
  const blockNav = (e, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && !url.startsWith(localOrigin)) e.preventDefault();
  };
  mainWindow.webContents.on('will-navigate', blockNav);
  mainWindow.webContents.on('will-redirect', blockNav);

  mainWindow.loadURL(`${localOrigin}/`);

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ─── Application menu (lets the user re-enter their token) ─── */
function buildMenu() {
  const template = [
    {
      label: 'TFLIX',
      submenu: [
        {
          label: 'Change TMDB Token…',
          accelerator: 'CmdOrCtrl+T',
          click: () => changeTokenFlow(),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ─── Bootstrap ─── */
app.whenReady().then(async () => {
  buildMenu();

  // In-app gear button (preload-main.js) asks to open the token setup.
  ipcMain.on('tflix:open-settings', () => changeTokenFlow());

  tmdbToken = readToken();
  await startServer();

  if (!tmdbToken) {
    const ok = await openSetupWindow();
    if (!ok || !tmdbToken) { app.quit(); return; }
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
