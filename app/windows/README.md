# TFLIX Desktop (Windows)

A native Windows app that wraps the live TFLIX website using
[Electron](https://www.electronjs.org/).

The window loads the deployed site (<https://tflix.stream>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change appear
instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds try
to open, so browsing and playback stay inside the app window — no stray browser tabs, no ads.

## Install

📥 Download the latest installer (`tflix-windows.setup.<version>.exe`) from **Get Apps** in the
site's profile menu, or from the [latest release](https://github.com/TomasTNunes/tflix/releases/latest),
then run it.

The installer isn't code-signed, so the browser may say it "isn't commonly downloaded" (choose
**Keep**) and Windows may show **Windows protected your PC** (click **More info → Run anyway**).

## Update

TFLIX doesn't auto-update, but it tells you when an update is out: a pop-up when the app
opens (with **Don't show again for this update**; it closes itself after 20 seconds) and a
yellow dot on the profile icon until you update.

To update, click **Update** — in that pop-up, or on the Windows card in **Get Apps** (profile
menu). The new installer downloads in your browser; run it. You can also grab the latest
`tflix-windows.setup.<version>.exe` from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest).
There's **no need to uninstall the old version first**.

> **Updating from 1.1.x:** TFLIX moved to `tflix.stream`, and version 1.2.0 is the first to use
> the new address — older versions can't open it. After updating you may need to sign in again;
> a My List saved to your account comes right back.

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

The NSIS installer (`tflix-windows.setup.<version>.exe`) is written to `app/windows/dist/`.
To change the app version, edit `version` in `package.json`. The app
ships as a thin shell — it loads the site over the network, so no site files are bundled.

## Project layout

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — window, menu, pop-up/ad blocking, loads the live site |
| `preload-main.js` | Injects the version label + back-navigation state restore into the site; stops ad scripts swallowing clicks inside the stream embeds |
| `scripts/make-icon.js` | Builds `build/icon.ico` from `../../assets/icons/*.png` |
