/* ───────────────────────────────────────────────────────────────
   TFLIX Desktop — Electron main process

   A thin native shell around the live TFLIX website
   (https://tflix.nunesnetwork.com). The window loads the deployed
   site directly, so any change to the site — new stream servers,
   fixed embeds — appears instantly, with no app rebuild or re-release.

   The app's only job is ad-blocking: it denies every pop-up / new
   window and keeps the top frame pinned to the TFLIX origin, so the
   popunder ads the third-party stream embeds fire never open.
   ─────────────────────────────────────────────────────────────── */

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/* ─── The live site this shell wraps ─── */
const SITE_URL = 'https://tflix.nunesnetwork.com/';
const SITE_ORIGIN = new URL(SITE_URL).origin;   // https://tflix.nunesnetwork.com

let mainWindow = null;

/* ─── Window icon (only exists in dev / when generated) ─── */
function windowIcon() {
  const ico = path.join(__dirname, 'build', 'icon.ico');
  return fs.existsSync(ico) ? ico : undefined;
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

  // Block ALL pop-ups / new windows. The third-party stream embeds fire
  // popunder ads via window.open / target=_blank — denying them here means
  // no browser tab and no ad ever opens. (Sub-frames route through here too.)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Keep the top frame pinned to the TFLIX site: ad scripts sometimes try to
  // hijack the whole page via top.location = adURL. Allow only same-site nav.
  //
  // IMPORTANT: only guard the MAIN frame. These events also fire for the
  // third-party stream <iframe>s, which legitimately navigate and (server-side)
  // redirect cross-origin to load their players. Blocking those left the embeds
  // black (Xayah/Ekko) or on the host's own 500 page (Naafiri).
  const blockNav = (e, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && !url.startsWith(SITE_ORIGIN)) e.preventDefault();
  };
  mainWindow.webContents.on('will-navigate', blockNav);
  mainWindow.webContents.on('will-redirect', blockNav);

  mainWindow.loadURL(SITE_URL);

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ─── Application menu ─── */
function buildMenu() {
  const template = [
    {
      label: 'TFLIX',
      submenu: [
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
app.whenReady().then(() => {
  // Present a plain-Chrome User-Agent to every request. Electron's default UA
  // carries "tflix-app/1.0.0 … Electron/42.x" tokens, and some embed hosts
  // reject non-browser clients on that basis (vidfast.pro / "Naafiri" returned
  // HTTP 500 from a same-origin POST until these tokens were stripped).
  app.userAgentFallback = app.userAgentFallback
    .replace(/\s*tflix-app\/[\d.]+/i, '')
    .replace(/\s*Electron\/[\d.]+/i, '');

  buildMenu();

  // Version label (preload-main.js) asks for the app version synchronously.
  ipcMain.on('tflix:get-version', (e) => { e.returnValue = app.getVersion(); });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
