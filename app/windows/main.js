/* ───────────────────────────────────────────────────────────────
   TFLIX Desktop — Electron main process

   A thin native shell around the live TFLIX website
   (https://tflix.stream). The window loads the deployed
   site directly, so any change to the site — new stream servers,
   fixed embeds — appears instantly, with no app rebuild or re-release.

   The app's only job is ad-blocking: it denies every pop-up / new
   window and keeps the top frame pinned to the TFLIX origin, so the
   popunder ads the third-party stream embeds fire never open.
   ─────────────────────────────────────────────────────────────── */

const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/* ─── The live site this shell wraps ───
   The app's own address: Cloudflare redirects it (302, so it's rechecked on
   every launch) to https://tflix.stream/?app=windows. Pointing that redirect
   elsewhere retires or redirects every installed copy without an update. */
const SITE_URL = 'https://appwindows.tflix.stream/';

/* The top frame may navigate anywhere on these domains or their subdomains
   (over HTTPS) — the old and new TFLIX domains, so moving between them and
   the redirect from one to the other keep working. */
const ALLOWED_DOMAINS = ['nunesnetwork.com', 'tflix.stream'];

function isAllowedSite(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/* The site's Support button links here — the one pop-up we let through,
   handed to the system browser instead of opening an app window. */
const SUPPORT_URL = 'https://github.com/TomasTNunes/tflix';

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
      // The preload also runs inside the stream embeds, where it stops ad
      // scripts from swallowing player clicks. Stays sandboxed: despite the
      // option's name, no Node.js reaches those third-party frames.
      nodeIntegrationInSubFrames: true,
      sandbox: true,
    },
  });

  // Block ALL pop-ups / new windows. The third-party stream embeds fire
  // popunder ads via window.open / target=_blank — denying them here means
  // no browser tab and no ad ever opens. (Sub-frames route through here too.)
  // Sole exception: the site's Support link, which goes to the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SUPPORT_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keep the top frame pinned to the TFLIX site: ad scripts sometimes try to
  // hijack the whole page via top.location = adURL. Allow only TFLIX's domains.
  //
  // IMPORTANT: only guard the MAIN frame. These events also fire for the
  // third-party stream <iframe>s, which legitimately navigate and (server-side)
  // redirect cross-origin to load their players. Blocking those left the embeds
  // black (Xayah/Ekko) or on the host's own 500 page (Naafiri).
  const blockNav = (e, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && !isAllowedSite(url)) e.preventDefault();
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
