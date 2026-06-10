# TFLIX Desktop (Windows)

A native Windows app that wraps the live TFLIX website using
[Electron](https://www.electronjs.org/).

The window loads the deployed site (<https://tflix.nunesnetwork.com>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change appear
instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds try
to open, so browsing and playback stay inside the app window — no stray browser tabs, no ads.

## Install

📥 Download the latest installer (`TFLIX Setup <version>.exe`) from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest), then run it.

## Update

TFLIX doesn't auto-update — you update it by downloading the newest installer and
running it. Grab the latest `TFLIX Setup <version>.exe` from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest) and run it;
there's **no need to uninstall the old version first**.

The installer detects your existing install and upgrades it in place: it replaces the
old version, keeps your desktop/Start-menu shortcuts, and **preserves your saved settings**
(such as your chosen stream server, in `%APPDATA%\tflix-app`). Just click through the wizard
(**Next → Install**).

> The app loads the live website, so there's nothing to configure — no API token, no setup.
> Just install and open it.

## Keyboard shortcuts

The menu bar is auto-hidden — tap `Alt` to reveal it. These accelerators work anywhere:

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Reload the page |
| `Ctrl+Shift+R` | Force reload (ignore cache) |
| `Ctrl+Shift+I` | Toggle DevTools |
| `Ctrl+0` | Reset zoom |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `F11` | Toggle fullscreen |
| `Ctrl+W` / `Alt+F4` | Quit |

## Run in development

```powershell
cd app/windows
npm install
npm start
```

`npm start` regenerates the app icon, then launches Electron pointed at the live site.

## Build the Windows installer

```powershell
cd app/windows
npm install
npm run build
```

The NSIS installer (`TFLIX Setup <version>.exe`) is written to `app/windows/dist/`. The app
ships as a thin shell — it loads the site over the network, so no site files are bundled.

## Project layout

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — window, menu, pop-up/ad blocking, loads the live site |
| `preload-main.js` | Injects the version label + back-navigation state restore into the site |
| `scripts/make-icon.js` | Builds `build/icon.ico` from `../../assets/icons/*.png` |
