# TFLIX Android (Phone + Android TV)

A native Android app that wraps the live TFLIX website in a WebView — the Android
counterpart of the Windows desktop app. One APK works on **phones, tablets, and
Android TV** (it registers both the regular and the Leanback TV launcher).

The app loads the deployed site (<https://tflix.stream>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change
appear instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds
try to open:

- every `window.open` / `target="_blank"` is denied → no popunder ad ever opens
  (except links to `github.com/TomasTNunes/tflix`, which open in the system browser;
  release downloads from the site's **Get Apps** menu are saved to Downloads by the
  system Download Manager instead — tap the finished notification to install/update; on
  Android TV the installer opens by itself once the download finishes)
- the top frame is pinned to TFLIX's domains (`tflix.stream`, `nunesnetwork.com` and their
  subdomains, HTTPS only) → ad scripts can't hijack the page
- the stream `<iframe>`s still navigate freely (blocking them breaks the embeds)
- requests to known ad networks come back empty → their in-player ads have nothing to show.
  The list lives on the site, see [Ad blocking lists](#ad-blocking-lists)
- inside the embeds, scripts only run from the embed's own domain and a short list of player
  libraries, so ad scripts are stopped even on domains nobody has listed; video and subtitles
  are data, so they load from anywhere (`assets/embed-guard.js`)
- ad scripts and invisible ad links can't swallow taps on the players (`assets/embed-guard.js`)

It also presents a plain-Chrome User-Agent (the WebView default carries `; wv` /
`Version/4.0` tokens some embed hosts reject) and supports fullscreen video.

## Install (sideload)

1. Download `tflix-android.<version>.apk` from **Get Apps** in the site's profile menu, or from
   the [latest release](https://github.com/TomasTNunes/tflix/releases/latest).
2. **Phone/tablet**: open the APK and allow "install unknown apps" when prompted.
3. **Android TV**: install via a file manager app (e.g. *Send files to TV*, *X-plore*)
   or with adb: `adb install tflix-android.<version>.apk`.

## Update

The app tells you when an update is out: a pop-up when it opens (with **Don't show again for this
update**; it closes itself after 20 seconds) and a yellow dot on the profile icon until you update.

Tap **Update** — in that pop-up, or on the Android card in **Get Apps** (profile menu). The APK
downloads with Android's Download Manager, no browser needed:

- **Phone/tablet**: tap the finished download notification to install it over the old version.
  The first time, Android asks you to allow installs from Download Manager (or your Files app) —
  allow it, come back and tap **Update** again.
- **Android TV**: the installer opens by itself when the download finishes (if TFLIX is still
  open). The first time, Android asks you to allow TFLIX to install apps — allow it, come
  back and tap **Update** again.

It installs over the old version, **no need to uninstall first**. You can also download the newest
`tflix-android.<version>.apk` from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest) and install it the same
way as the first time (with adb: `adb install -r tflix-android.<version>.apk`).

> **Updating from 1.1.0:** that version can't download in the app — **Update** opens your
> browser instead (on a TV without one, install the new APK with a file manager or adb).
> From then on, updates download in the app.

> **Updating from 1.0.0:** TFLIX moved to `tflix.stream`, and version 1.1.0 is the first to use
> the new address — older versions can't open it. After updating you may need to sign in again;
> a My List saved to your account comes right back.

## Build

Requirements: JDK 17+, Android SDK (platform 35 / build-tools 35.x). Point the build
at your SDK with `local.properties` (`sdk.dir=...`) or the `ANDROID_HOME` env var.

**Windows (PowerShell):**

```powershell
cd app/android
.\gradlew.bat assembleRelease   # → tflix-android.<version>.apk (debug-signed — see note)
.\gradlew.bat assembleDebug     # → tflix-android.debug.<version>.apk
```

**Linux / macOS:**

```bash
cd app/android
chmod +x gradlew                # first time only
./gradlew assembleRelease       # → tflix-android.<version>.apk (debug-signed — see note)
./gradlew assembleDebug         # → tflix-android.debug.<version>.apk
```

The APK lands in `app/build/outputs/apk/<variant>/`.

To change the app version, edit `versionCode` and `versionName` in
`app/build.gradle.kts` (`defaultConfig`) — bump both on every release.

> The release build is **debug-signed** so it can be sideloaded directly. Before any
> Play Store upload, replace the `signingConfig` in `app/build.gradle.kts` with a real
> release keystore.

## Ad blocking lists

[`assets/app-lists.json`](../../assets/app-lists.json) on the site holds two lists, so they can
change without an app update:

- `adHosts`: requests to these hosts, and anything under them, come back empty. Check what a host
  serves before adding it: the embeds' video comes from equally odd-looking domains, and blocking
  one of those stops playback.
- `scriptLibraries`: where the embeds may load scripts from, besides their own domain. Every other
  outside script is blocked, so if a server stops playing because of a blocked script, add its
  source here, as a plain `https://` address.

To change them, edit the file and run the Deploy Website workflow. Apps check at launch, and when
a movie starts or the app comes back if their last check was over 6 hours ago. A file with any
invalid entry is ignored whole, so a typo can't break the apps, and a new `scriptLibraries` list
applies from the next page.

Copy the file to `app/android/app/src/main/assets/app-lists.json` when you release a new version,
so new installs start from the current lists.

## Android TV notes

- The app appears in the TV launcher (Leanback intent + banner) and installs without
  touch hardware (`touchscreen required=false`).
- D-pad navigation quality depends on the **website's** focus handling — improving
  remote/focus navigation is web-side work on the site itself, not app work.
- The players' own buttons can't be reached by key navigation, because they're in iframes, so
  the app has a cursor for them: press **OK** on the highlighted player or on a server, then
  **arrows** move it, **OK** clicks and **Back** turns it off. It brightens over anything
  clickable. Play/pause, fast-forward and rewind keys work directly, if the remote has them.

## Project layout

| File | Purpose |
|------|---------|
| `app/src/main/java/.../MainActivity.kt` | The whole app — WebView, pop-up/ad blocking, fullscreen video, back handling |
| `app/src/main/java/.../PlayerCursor.kt` | Android TV: the remote-driven cursor over the player |
| `app/src/main/assets/version-label.js` | The small version label (lower-left, at the bottom of the page) — the site's Get Apps menu reads it to offer updates |
| `app/src/main/assets/embed-guard.js` | Runs inside the stream embeds before their scripts — blocks outside scripts except the player libraries it lists, and stops ad scripts and invisible ad links swallowing taps |
| `app/src/main/java/.../AppLists.kt` | Keeps the ad blocking lists up to date from the site |
| `app/src/main/assets/app-lists.json` | The lists the app starts with, until it has downloaded the site's copy |
| `app/src/main/AndroidManifest.xml` | Phone + TV (Leanback) launcher entries, TV feature flags |
| `app/src/main/res/` | Launcher icons, TV banner, dark theme |
