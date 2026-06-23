# TFLIX webOS (LG TV)

A native LG TV app that wraps the live TFLIX website — the webOS counterpart of the
Windows desktop and Android apps. It's a packaged **webOS web app**: on launch it
hands the whole app card to the deployed site (<https://tflix.nunesnetwork.com>), so
it's **always up to date** — new stream servers, fixed embeds, and any other site
change appear instantly, with no app update needed.

## How it works

The packaged app is a single page ([`index.html`](index.html)) that shows a TFLIX
splash and then navigates the app card to the live site with `location.replace`. The
site then owns the document, so:

- its own arrow-key poster navigation works natively (webOS is Chromium-based, like a
  desktop browser);
- the TV remote's **Back** button exits the app directly from the site (no history
  entry is pushed for the splash).

**Ad / pop-up blocking** comes for free here: the third-party stream embeds fire their
popunder ads via `window.open`, but a webOS TV web app is single-card and has no
pop-up surface, so those windows simply never open — the same result the desktop and
Android shells achieve by explicitly denying pop-ups.

## Requirements

- **LG TV with webOS** and **Developer Mode** enabled.
- The **webOS TV CLI** (`ares-*` commands), from either the
  [webOS TV SDK](https://webostv.developer.lge.com/develop/tools/sdk-introduction) or
  standalone: `npm install -g @webos-tools/cli` (provides `ares-package`,
  `ares-install`, `ares-launch`).

### Enable Developer Mode on the TV (one time)

1. Create a free account at <https://webostv.developer.lge.com/> and sign in on the TV.
2. Install the **Developer Mode** app from the LG Content Store, open it, log in, and
   turn **Dev Mode Status** on (the TV restarts). Note the TV's **IP address** and the
   **passphrase** shown in that app.
3. Keep the Developer Mode app's session alive (it expires after ~50 hours; "Extend"
   resets it).

## Build & install

Run these from this folder (`app/webOS`).

**1. Package into an `.ipk`:**

```bash
ares-package .
# → com.nunesnetwork.tflix_1.0.0_all.ipk
```

**2. Register the TV as a target (first time only)** — use the IP + passphrase from the
Developer Mode app:

```bash
ares-setup-device          # interactive: add a device, paste the passphrase
# or non-interactive:
ares-novacom --device <name> --getkey   # fetch/confirm the dev key
```

**3. Install on the TV and launch:**

```bash
ares-install --device <name> ./com.nunesnetwork.tflix_1.0.0_all.ipk
ares-launch  --device <name> com.nunesnetwork.tflix
```

The app then appears on the TV's home launcher like any other app.

To change the app version, bump `"version"` in [`appinfo.json`](appinfo.json) and
re-package.

## Project layout

| File | Purpose |
|------|---------|
| [`appinfo.json`](appinfo.json) | webOS app metadata (id, title, icons, splash, type `web`) |
| [`index.html`](index.html) | The whole app — splash + top-level navigation to the live site |
| `icon.png` | 80×80 launcher icon |
| `largeIcon.png` | 130×130 large launcher icon |
| `splash.png` | 1920×1080 launch background |

## Notes

- **Remote / focus navigation quality** depends on the **website's** key handling —
  improving it is web-side work on the site itself, not app work (same as the Android
  app's D-pad note).
- The app id (`com.nunesnetwork.tflix`) matches the Windows and Android builds for
  consistency across platforms.
