# TFLIX Android (Phone + Android TV)

A native Android app that wraps the live TFLIX website in a WebView — the Android
counterpart of the Windows desktop app. One APK works on **phones, tablets, and
Android TV** (it registers both the regular and the Leanback TV launcher).

The app loads the deployed site (<https://tflix.nunesnetwork.com>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change
appear instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds
try to open:

- every `window.open` / `target="_blank"` is denied → no popunder ad ever opens
- the top frame is pinned to the TFLIX origin → ad scripts can't hijack the page
- the stream `<iframe>`s still navigate freely (blocking them breaks the embeds)

It also presents a plain-Chrome User-Agent (the WebView default carries `; wv` /
`Version/4.0` tokens some embed hosts reject) and supports fullscreen video.

## Install (sideload)

1. Download `tflix-android.<version>.apk` from the
   [latest release](https://github.com/TomasTNunes/tflix/releases/latest).
2. **Phone/tablet**: open the APK and allow "install unknown apps" when prompted.
3. **Android TV**: install via a file manager app (e.g. *Send files to TV*, *X-plore*)
   or with adb: `adb install tflix-android.<version>.apk`.

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

## Android TV notes

- The app appears in the TV launcher (Leanback intent + banner) and installs without
  touch hardware (`touchscreen required=false`).
- D-pad navigation quality depends on the **website's** focus handling — improving
  remote/focus navigation is web-side work on the site itself, not app work.

## Project layout

| File | Purpose |
|------|---------|
| `app/src/main/java/.../MainActivity.kt` | The whole app — WebView, pop-up/ad blocking, fullscreen video, back handling |
| `app/src/main/AndroidManifest.xml` | Phone + TV (Leanback) launcher entries, TV feature flags |
| `app/src/main/res/` | Launcher icons, TV banner, dark theme |
