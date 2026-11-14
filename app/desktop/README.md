# TFLIX Desktop (Windows & Linux)

A native desktop app for Windows and Linux that wraps the live TFLIX website using
[Electron](https://www.electronjs.org/). The same code builds both.

The window loads the deployed site (<https://tflix.stream>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change appear
instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds try
to open, so browsing and playback stay inside the app window — no stray browser tabs, no ads.

> The app loads the live website, so there's nothing to configure — no API token, no setup.
> Just install and open it.

## Windows

### Install

📥 Download the latest installer (`tflix-windows.setup.<version>.exe`) from **Get Apps** in the
site's profile menu, or from the [latest release](https://github.com/TomasTNunes/tflix/releases/latest),
then run it.

The installer isn't code-signed, so the browser may say it "isn't commonly downloaded" (choose
**Keep**) and Windows may show **Windows protected your PC** (click **More info → Run anyway**).

### Update

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

## Linux

Each release has six Linux files: a .deb, a Flatpak and an AppImage, each for two kinds of
processor. Pick the kind of file:

| File | For | What it is |
|------|-----|------------|
| `tflix-linux.<version>.<cpu>.deb` | Ubuntu, Debian, Linux Mint, Raspberry Pi OS | A package: installs TFLIX into your app menu |
| `tflix-linux.<version>.<cpu>.flatpak` | Fedora, Pop!_OS, Steam Deck, any distro with Flatpak | A Flatpak app: installs TFLIX into your app menu, in Flatpak's sandbox |
| `tflix-linux.<version>.<cpu>.AppImage` | Any other distro | A single file you run; nothing gets installed |

…and the processor (`<cpu>`): **`x64`** for almost every PC and laptop (Intel or AMD), or
**`arm64`** for a Raspberry Pi 4/5 (64-bit OS) or an ARM laptop. Not sure? Run `uname -m`:
`x86_64` means x64, `aarch64` means arm64.

All six are in **Get Apps** (the Linux card's **Download** lists them, with your processor first
when the browser says which it is) and in the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest).

### Install the .deb

Open the downloaded file (it opens in your software center) and click **Install**, or run this
in the folder you saved it to:

```bash
sudo apt install ./tflix-linux.*.deb
```

Then open **TFLIX** from your app menu.

### Install the Flatpak

Open the downloaded file (it opens in your software store) and click **Install**, or run this
in the folder you saved it to:

```bash
flatpak install ./tflix-linux.*.flatpak
```

Then open **TFLIX** from your app menu. The first Flatpak app on a computer also downloads the
shared Flatpak runtime from Flathub (a few hundred MB, once).

No Flatpak on your system yet (Ubuntu, for example)? Install it once, then log out and back in
so your app menu shows Flatpak apps:

```bash
sudo apt install flatpak
```

The Flatpak keeps its settings in `~/.var/app/stream.tflix.TFLIX/`, apart from the .deb's, so
moving from the .deb to the Flatpak starts with fresh settings; sign in to bring back your list.

### Run the AppImage

Make the file executable, then double-click it, or run it from a terminal:

```bash
chmod +x tflix-linux.*.AppImage
./tflix-linux.*.AppImage
```

(Most file managers can do the first step too: right-click → **Properties** → **Allow executing
as program**.) Recent Ubuntu versions need one extra step before the AppImage runs. See below.

### AppImage on Ubuntu 24.04 and later

TFLIX always runs web pages inside Chromium's security sandbox, because the video players run
third-party ad code. Ubuntu 23.10 and later (and distros based on them) only let an app use
that sandbox if an AppArmor rule allows it. The .deb installs its rule itself; an AppImage
can't, so the system blocks its sandbox.

TFLIX won't run without the sandbox, so on such a system the AppImage opens a message instead.
Either **use the .deb**, or allow the AppImage once: click **Allow and open TFLIX** in that
message and enter your password in the window that asks for it. TFLIX adds the rule below and
opens.

If that doesn't work (for example on a desktop without a password window), run this in a
terminal instead, then open TFLIX again:

```bash
printf 'abi <abi/4.0>,\ninclude <tunables/global>\n\nprofile tflix-appimage /tmp/.mount_*/tflix flags=(unconfined) {\n  userns,\n}\n' | sudo tee /etc/apparmor.d/tflix-appimage > /dev/null && sudo apparmor_parser -r /etc/apparmor.d/tflix-appimage
```

It adds a rule like the .deb's, for the TFLIX program inside a running AppImage. It stays in
place for future versions too. It lets any program at that location use the sandbox, which
every program could do before Ubuntu 23.10. To remove it:

```bash
sudo apparmor_parser -R /etc/apparmor.d/tflix-appimage && sudo rm /etc/apparmor.d/tflix-appimage
```

### Update

The app tells you when an update is out, just like on Windows: a pop-up when it opens and a
yellow dot on the profile icon. Click **Update** (in the pop-up, or on the Linux card in **Get
Apps**) and the list of Linux files opens with **yours highlighted**: the same kind of file you
have (a .deb, a Flatpak or an AppImage, whichever you're running), for the same processor.
Click its **Update**.

- **.deb:** open the new file, or `sudo apt install ./tflix-linux.<version>.<cpu>.deb`. It upgrades
  the installed version in place. There's no need to uninstall.
- **Flatpak:** `flatpak install ./tflix-linux.<version>.<cpu>.flatpak`, the same
  command as the first time. It replaces the installed version. There's no need to uninstall.
- **AppImage:** make the new file executable and run it, then delete the old one. If you made a
  shortcut to the old file, point it at the new one.

Your settings (such as your chosen stream server) are kept either way, in `~/.config/tflix-app`
(the Flatpak's in `~/.var/app/stream.tflix.TFLIX/config/tflix-app`).

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
| `Ctrl+W` / `Alt+F4` (Windows) · `Ctrl+Q` (Linux) | Quit |

## Run in development

```powershell
cd app/desktop
npm install
npm start
```

`npm start` regenerates the app icons, then launches Electron pointed at the live site.

## Build the Windows installer

```powershell
cd app/desktop
npm install
npm run build
```

The NSIS installer (`tflix-windows.setup.<version>.exe`) is written to `app/desktop/dist/`.
To change the app version, edit `version` in `package.json` (it's shared by Windows and Linux).
The app ships as a thin shell — it loads the site over the network, so no site files are bundled.

## Build the Linux packages

Linux packages have to be built on Linux. The easy way is GitHub Actions: the
[Build Linux App](../../.github/workflows/build-linux.yml) workflow runs only by hand, from
the **Actions** tab (**Run workflow**). It builds the x64 files on an Intel/AMD runner and the
arm64 files on an ARM runner, starts each one for 20 seconds as a check, and saves them under
the run's **Artifacts**. Given a **release tag** (e.g. `v1.3.0`), it also attaches all six
files to that release, which must already exist.

On your own Linux machine (or in WSL on Windows), with Node 22.12 or later:

```bash
cd app/desktop
npm ci
npm run build:linux
```

This builds all four files (`tflix-linux.<version>.<x64|arm64>.<AppImage|deb>`) into
`app/desktop/dist/`; an Intel/AMD machine can build the arm64 ones too, it just can't run them.
For one processor only, run `npx electron-builder --linux --x64` (or `--arm64`) after
`node scripts/make-icon.js`. In WSL, build from a copy in your Linux home folder, not under `/mnt/c`:
the `node_modules` installed on Windows don't work on Linux.

That doesn't build the Flatpak. It's made from the .deb, so after building the .deb for your
processor, with `flatpak` and `flatpak-builder` installed:

```bash
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
cp dist/tflix-linux.*.x64.deb flatpak/tflix.deb      # or .arm64.deb on ARM
flatpak-builder --user --install-deps-from=flathub --force-clean --default-branch=stable --install flatpak/build flatpak/stream.tflix.TFLIX.yml
flatpak run stream.tflix.TFLIX
```

The workflow builds it the same way, then bundles it into the `.flatpak` file.

## Project layout

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — window, menu, pop-up/ad blocking, loads the live site; on Linux, keeps the AppImage from running without the sandbox |
| `preload-main.js` | Injects the version label (and, on Linux, whether it's the .deb, the Flatpak or the AppImage) + back-navigation state restore into the site; stops ad scripts swallowing clicks inside the stream embeds |
| `flatpak/stream.tflix.TFLIX.yml` | Flatpak manifest: repackages the .deb, with the desktop file, icons and AppStream file renamed to the Flatpak's ID |
| `flatpak/tflix.sh` | The Flatpak's launcher: starts TFLIX through zypak, which gives Chromium its sandbox inside Flatpak |
| `offline.html` | Shown instead of an empty window when the site doesn't load (no internet); Try again, or reloads by itself once back online |
| `build/com.nunesnetwork.tflix.appdata.xml` | AppStream metadata in the AppImage and the Flatpak (description, screenshot, license) for app stores and the AppImage catalog; its newest `<release>` must match `package.json`'s version |
| `build/tflix.desktop` | Copy of the AppImage's desktop file at `usr/share/applications/`, where AppStream looks for it; keep it like the one electron-builder generates |
| `scripts/make-icon.js` | Builds `build/icon.ico` (Windows) and `build/icons/*.png` (Linux) from `../../assets/icons/*.png` |
| `build/installer.nsh` | Windows installer extras (optional "remove my data" on uninstall) |
| `../../.github/workflows/build-linux.yml` | Builds, checks and (optionally) releases the Linux packages |
