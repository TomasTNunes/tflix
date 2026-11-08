# TFLIX webOS (LG TV)

A native LG TV app that wraps the live TFLIX website — the webOS counterpart of the
Windows desktop and Android apps. It's a packaged **webOS web app**: on launch it
hands the whole app card to the deployed site (<https://tflix.stream>), so it's
**always up to date** — new stream servers, fixed embeds, and any other site change
appear instantly, with no app update needed.

## How it works

The packaged app is a single page ([`index.html`](index.html)) that shows the TFLIX
splash, checks that the site answers, and then navigates the app card to it with
`location.replace`. It opens `appwebos.tflix.stream`, which Cloudflare redirects (302)
to `https://tflix.stream/?app=webos`, so that redirect can move or retire every
installed copy without an update.

The site then owns the document, so:

- its own arrow-key navigation works natively (webOS is Chromium-based);
- the remote's **Back** follows the page's history, closing an open title or leaving
  the player, and exits the app from the home page (no history entry is pushed for the
  splash).

The packaged page can't add scripts to the site, so what the TV needs lives on the site,
behind `?app=webos`:

- [`assets/webos.js`](../../assets/webos.js): Back from the player returns to the same
  search, title, season and episode, scroll position and card;
- **OK** on a server card picks it and moves straight to the player.

### No ad blocking

Unlike the Windows and Android apps, this one has no native layer: once the site has
loaded, the packaged code is gone. It can't deny pop-ups, keep ads from redirecting the
page, block ad networks or run the script blocker inside the players. Treat it like a
browser without an ad blocker. What `window.open` from a player does on a TV isn't
documented by LG, so it needs testing on the real thing.

### Remotes

The players are cross-origin iframes, so the site's key navigation can only highlight
them. Their buttons need the **Magic Remote's pointer**, whose clicks reach them natively.
A basic remote can browse the site but can't press player buttons.

`disableBackHistoryAPI` stays `false` on purpose: with `true` the app must handle Back
itself, and the site gets no key events while focus is inside a player, so Back would
stop working there.

## Requirements

- **LG TV with webOS 22 (2022) or newer**, with **Developer Mode** enabled. The site's
  scripts need Chromium 85, and older TVs have Chromium 79 or lower: there the app says
  the TV is too old.
- The **webOS TV CLI** (`ares-*` commands), from either the
  [webOS TV SDK](https://webostv.developer.lge.com/develop/tools/sdk-introduction) or
  standalone: `npm install -g @webos-tools/cli` (provides `ares-package`,
  `ares-install`, `ares-launch`).

### Enable Developer Mode on the TV (one time)

1. Create a free account at <https://webostv.developer.lge.com/> and sign in on the TV.
2. Install the **Developer Mode** app from the LG Content Store, open it, log in, and
   turn **Dev Mode Status** on (the TV restarts). Note the TV's **IP address** and the
   **passphrase** shown in that app.
3. Keep the Developer Mode session alive: that app shows the time left, and **Extend**
   resets it. **When it runs out, apps installed this way are removed from the TV.** Older
   reports give 50 hours and newer ones 1000, so check your own TV.

## Build & install

Run these from this folder (`app/webOS`).

**1. Package into an `.ipk`:**

```bash
ares-package .
# → com.nunesnetwork.tflix_1.1.0_all.ipk
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
ares-install --device <name> ./com.nunesnetwork.tflix_1.1.0_all.ipk
ares-launch  --device <name> com.nunesnetwork.tflix
```

The app then appears on the TV's home launcher like any other app.

To change the app version, bump `"version"` in [`appinfo.json`](appinfo.json) and
re-package.

## Project layout

| File | Purpose |
|------|---------|
| [`appinfo.json`](appinfo.json) | webOS app metadata (id, title, icons, splash, screen saver, type `web`) |
| [`index.html`](index.html) | The whole app — splash, startup checks and navigation to the live site |
| `icon.png` | 80×80 launcher icon, from `assets/icons/icon_1024.png` |
| `largeIcon.png` | 130×130 large launcher icon, from the same |
| `splash.png` | 1920×1080 launch background, from `assets/icons/webos-splash.svg` |

## Notes

- **Remote / focus navigation quality** depends on the **website's** key handling —
  improving it is web-side work on the site itself, not app work (same as the Android
  app's D-pad note).
- `screenSaverProperties.preferredType: 2` extends the screen saver timeout to 30 minutes
  (the closest thing to Android's keep-screen-on).
- The app id (`com.nunesnetwork.tflix`) matches the Windows and Android builds for
  consistency across platforms.
