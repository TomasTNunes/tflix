# TFLIX Desktop (Windows)

Wraps the TFLIX website in a native Windows app using [Electron](https://www.electronjs.org/).
It runs a tiny local HTTP server that serves the site files in the repo root
(`../../index.html`, `../../stream`, `../../assets`), so the player route (`/stream`) and the
`__TMDB_TOKEN__` injection behave exactly like the deployed site.

It also blocks all pop-ups and ad redirects that the third-party stream embeds try to
open, so browsing and playback stay inside the app window — no stray browser tabs.

## Install

📥 Download the latest installer (`TFLIX Setup <version>.exe`) from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest), then run it.

## The TMDB token

On first launch the app shows a setup screen asking for your **TMDB API Read Access Token**
(v4 auth). It verifies the token against the TMDB API and stores it in your per-user
app-data folder (`%APPDATA%/TFLIX/tflix.config.json`). After a successful save the app
relaunches the main window so the new token takes effect immediately.

Get a free token at <https://www.themoviedb.org/settings/api> (the *API Read Access Token*).

### Changing the token later

There are three equivalent ways to re-open the token screen:

| Method | How |
|--------|-----|
| **Gear button** | Click the floating ⚙ button in the bottom-right corner of any browse page |
| **Keyboard shortcut** | Press `Ctrl+T` (`Cmd+T` on macOS) |
| **Menu** | **TFLIX → Change TMDB Token…** (press `Alt` to reveal the hidden menu bar) |

> The gear button is hidden on the `/stream` player page to keep it out of the way of
> the playback UI.

## Keyboard shortcuts

The menu bar is auto-hidden — tap `Alt` to reveal it. These accelerators work anywhere:

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | Change TMDB Token… |
| `Ctrl+R` | Reload the page |
| `Ctrl+Shift+R` | Force reload (ignore cache) |
| `Ctrl+Shift+I` | Toggle DevTools |
| `Ctrl+0` | Reset zoom |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `F11` | Toggle fullscreen |
| `Ctrl+W` / `Alt+F4` | Quit |

On the setup screen, `Ctrl+Enter` validates and saves the token.

## Run in development

```powershell
cd app/windows
npm install
npm start
```

`npm start` regenerates the app icon, then launches Electron pointed at the repo-root
site files (no rebuild needed when you edit the site).

## Build the Windows installer

```powershell
cd app/windows
npm install
npm run build
```

The NSIS installer (`TFLIX Setup <version>.exe`) is written to `app/windows/dist/`.
The site files (`index.html`, `404.html`, `assets`, `stream`) are bundled as
`extraResources`, so the packaged app is fully self-contained.

## Project layout

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — local server, token storage, windows, menu, pop-up/ad blocking |
| `setup.html` | First-run / change-token screen |
| `preload-setup.js` | Secure IPC bridge for the setup screen |
| `preload-main.js` | Injects the floating ⚙ gear button into the site |
| `scripts/make-icon.js` | Builds `build/icon.ico` from `../../assets/icons/*.png` |
