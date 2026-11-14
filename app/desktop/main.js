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

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const IS_LINUX = process.platform === 'linux';

/* ─── The live site this shell wraps ───
   The app's own address, one per platform: Cloudflare redirects it (302, so
   it's rechecked on every launch) to https://tflix.stream/?app=windows or
   ?app=linux. Pointing a redirect elsewhere retires or redirects every
   installed copy on that platform without an update. */
const SITE_URL = IS_LINUX ? 'https://applinux.tflix.stream/' : 'https://appwindows.tflix.stream/';

/* How this copy was installed, so the site's Update button fetches the same
   kind of file for the same CPU: on Linux, the AppImage runtime sets
   $APPIMAGE to the file's path; Flatpak sets $FLATPAK_ID in every app, and
   our .flatpak file also sets $TFLIX_FLATPAK_SOURCE=file (flatpak/
   stream.tflix.TFLIX.yml), which Flathub's build leaves out: 'flathub'
   installs update from Flathub, so the site offers them no file. Otherwise
   it's the .deb. process.arch is 'x64' or 'arm64', as in the file names.
   Null on Windows (one installer). */
function packageKind() {
  if (process.env.APPIMAGE) return 'appimage';
  if (process.env.FLATPAK_ID) return process.env.TFLIX_FLATPAK_SOURCE === 'file' ? 'flatpak' : 'flathub';
  return 'deb';
}
const PACKAGE = !IS_LINUX ? null : { kind: packageKind(), arch: process.arch };

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

/* ─── Window icon ───
   Windows: build/icon.ico, only present in dev (the installed .exe carries
   its own icon). Linux: build/icons/256x256.png, which the Linux build also
   packs, as some desktops show the window's own icon, not the menu entry's. */
function windowIcon() {
  const icon = path.join(__dirname, 'build', ...(IS_LINUX ? ['icons', '256x256.png'] : ['icon.ico']));
  return fs.existsSync(icon) ? icon : undefined;
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
    show: !IS_LINUX,   // Linux: shown below
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

  // Linux (Wayland): a plain show() makes Chromium ask the desktop for three
  // window-activation tokens and use only one; GNOME shows a busy cursor for
  // each unused token until it times out (~15s). Showing the window without
  // activating it, then focusing it, asks for one token and uses it.
  if (IS_LINUX) { mainWindow.showInactive(); mainWindow.focus(); }

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

  // No internet, or the site unreachable: show the packed offline page, not
  // an empty window. It goes back to the page that didn't load (Try again, or
  // by itself once back online). ERR_ABORTED (-3) is a navigation cancelled
  // or replaced, not a failure. Only the main frame: embeds handle their own.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return;
    console.error(`[tflix] ${url} didn't load (${desc}); showing the offline page`);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'), {
      query: { retry: isAllowedSite(url) ? url : SITE_URL },
    });
  });

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

/* ─── Linux AppImage: never without the sandbox ───
   electron-builder's AppImage launcher (AppRun) adds --no-sandbox whenever
   its quick user-namespace probe (`unshare -Ur true`) fails, as on Ubuntu
   23.10+ where AppArmor blocks them. The video players run third-party ad
   code, so TFLIX doesn't run web pages without Chromium's sandbox.

   Instead this process starts the app again without the flag, as a child,
   and waits (the AppImage stays mounted while it lives; it never opens a
   page itself). That works whenever the sandbox can: the probe can't tell,
   e.g. once the TFLIX AppArmor rule (APPARMOR_PROFILE) lets this binary use
   user namespaces but not `unshare`. If the child dies at once, the sandbox
   is blocked here: explain, and offer to add that rule (pkexec asks for the
   password in the desktop's own prompt), then try again. */
const SANDBOX_GUARD = IS_LINUX && !!process.env.APPIMAGE && app.commandLine.hasSwitch('no-sandbox');
const SANDBOX_FAIL_WINDOW = 5000;   // a blocked sandbox kills the app at startup
const SANDBOX_HELP_URL = 'https://github.com/TomasTNunes/tflix/blob/main/app/desktop/README.md#appimage-on-ubuntu-2404-and-later';
// Lets the AppImage's binary (wherever it's mounted) use user namespaces,
// like the rule the .deb installs for /opt/TFLIX. The README gives the same
// rule as a terminal command, and the Linux workflow's smoke test applies it.
const APPARMOR_PROFILE_PATH = '/etc/apparmor.d/tflix-appimage';
const APPARMOR_PROFILE =
  'abi <abi/4.0>,\ninclude <tunables/global>\n\nprofile tflix-appimage /tmp/.mount_*/tflix flags=(unconfined) {\n  userns,\n}\n';

function relaunchWithSandbox() {
  console.error('[tflix] started with --no-sandbox; starting again with the sandbox');
  const started = Date.now();
  const child = spawn(process.execPath, process.argv.slice(1).filter(a => a !== '--no-sandbox'), { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if ((code !== 0 || signal) && Date.now() - started < SANDBOX_FAIL_WINDOW) {
      console.error('[tflix] the sandbox is blocked on this system; not running without it');
      app.whenReady().then(showSandboxBlocked);
    } else app.exit(code ?? 0);
  });
}

// Adds the rule as root: pkexec shows the desktop's password prompt. The
// profile goes in as an argument, so nothing in it is read by the shell.
// Resolves to '' on success, or why it failed.
function addAppArmorRule() {
  return new Promise(resolve => {
    const script = `printf '%s' "$1" > ${APPARMOR_PROFILE_PATH} && apparmor_parser -r ${APPARMOR_PROFILE_PATH}`;
    let err = '';
    const p = spawn('pkexec', ['/bin/sh', '-c', script, 'sh', APPARMOR_PROFILE]);
    p.stderr.on('data', d => { err += d; });
    p.on('error', () => resolve('no-pkexec'));
    p.on('exit', code => resolve(code === 0 ? '' : code === 126 || code === 127 ? 'cancelled' : err.trim() || `exit ${code}`));
  });
}

async function showSandboxBlocked() {
  let note = '';
  for (;;) {
    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: 'TFLIX',
      message: "TFLIX can't start its security sandbox",
      detail: 'This system (Ubuntu 24.04 and later, for example) blocks the sandbox for AppImages, '
        + "and TFLIX won't play videos without it.\n\n"
        + 'Allow it once: TFLIX adds a small system rule, like the one the .deb version installs, '
        + 'then opens. Your password is needed for that. Or install the .deb version instead '
        + '(Get Apps on tflix.stream).'
        + (note ? `\n\n${note}` : ''),
      buttons: ['Allow and open TFLIX', 'Open instructions', 'Quit'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 1) { shell.openExternal(SANDBOX_HELP_URL); continue; }
    if (response !== 0) break;
    const failed = await addAppArmorRule();
    if (!failed) { console.error('[tflix] AppArmor rule added'); relaunchWithSandbox(); return; }
    console.error('[tflix] adding the AppArmor rule failed:', failed);
    note = failed === 'cancelled' ? 'Nothing was changed (the password prompt was closed).'
         : failed === 'no-pkexec' ? "This system can't ask for the password here: Open instructions shows the command to run in a terminal."
         : `That didn't work (${failed}). Open instructions shows the command to run in a terminal.`;
  }
  app.exit(1);
}

/* ─── Bootstrap ─── */
if (SANDBOX_GUARD) relaunchWithSandbox();
else app.whenReady().then(() => {
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
  ipcMain.on('tflix:get-package', (e) => { e.returnValue = PACKAGE; });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
