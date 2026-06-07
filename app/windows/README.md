# TFLIX Desktop (Windows)

Wraps the TFLIX website in a native Windows app using [Electron](https://www.electronjs.org/).
It runs a tiny local HTTP server that serves the site files in the repo root
(`../../index.html`, `../../stream`, `../../assets`), so the player route (`/stream`) and the
`__TMDB_TOKEN__` injection behave exactly like the deployed site.

## How the TMDB token works

On first launch the app asks for your **TMDB API Read Access Token** (v4 auth),
verifies it against the TMDB API, and stores it in your per-user app-data folder
(`%APPDATA%/TFLIX/tflix.config.json`). You can change it later via the menu:
**TFLIX → Change TMDB Token…**

Get a free token at <https://www.themoviedb.org/settings/api> (the *API Read Access Token*).

## Run in development

```powershell
cd app/windows
npm install
npm start
```

## Build the Windows installer

```powershell
cd app/windows
npm install
npm run build
```

The installer (`TFLIX Setup <version>.exe`) is written to `app/windows/dist/`.

## Project layout

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — local server, token storage, windows, menu |
| `setup.html` | First-run / change-token screen |
| `preload-setup.js` | Secure IPC bridge for the setup screen |
| `scripts/make-icon.js` | Builds `build/icon.ico` from `../../assets/icons/*.png` |
