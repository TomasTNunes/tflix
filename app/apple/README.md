# TFLIX iOS / iPadOS

A native Apple app that wraps the live TFLIX website in a `WKWebView` — the
iOS/iPadOS counterpart of the Windows desktop app and the Android app. One app
works on **iPhone and iPad** (including Split View multitasking on iPad).

The app loads the deployed site (<https://tflix.nunesnetwork.com>) directly, so it's
**always up to date** — new stream servers, fixed embeds, and any other site change
appear instantly, with no app update needed.

Its job is to **block all pop-ups and ad redirects** that the third-party stream embeds
try to open:

- every `window.open` / `target="_blank"` is denied → no popunder ad ever opens
  (the site's Support link is the one exception — it goes to Safari)
- the top frame is pinned to the TFLIX origin → ad scripts can't hijack the page
- the stream `<iframe>`s still navigate freely (blocking them breaks the embeds)

It also presents a plain-Safari User-Agent (the `WKWebView` default lacks the
`Version/… Safari/…` tokens some embed hosts require), supports fullscreen video,
keeps the screen awake during playback, and supports edge-swipe back/forward
navigation (plus `⌘R` to reload with an iPad hardware keyboard).

## Install

Apple doesn't allow sideloading a plain APK-style download, so pick whichever fits:

- **AltStore / SideStore** (free Apple ID): download `tflix-ios.<version>.ipa` from the
  [latest release](https://github.com/TomasTNunes/tflix/releases/latest) and install it
  through [AltStore](https://altstore.io/) or [SideStore](https://sidestore.io/). The
  store re-signs the unsigned IPA with your Apple ID (free IDs require a re-sign every
  7 days — the store apps handle that).
- **Build & run from Xcode** (needs a Mac): open the project, set your team under
  *Signing & Capabilities*, and run it on your device.

> The IPA in releases is **unsigned** (no Apple Developer account is used), which is why
> it must go through AltStore/SideStore or Xcode rather than being tapped open directly.

## Build

Requirements: a Mac with Xcode 15+ (no dependencies, no CocoaPods/SPM — the project is
plain UIKit + WebKit).

**Xcode:** open `app/apple/TFLIX.xcodeproj` and hit Run.

**Command line (unsigned IPA, for AltStore/SideStore sideloading):**

```bash
cd app/apple
xcodebuild -project TFLIX.xcodeproj -scheme TFLIX -configuration Release \
  -sdk iphoneos -derivedDataPath build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
mkdir -p Payload
cp -R build/Build/Products/Release-iphoneos/TFLIX.app Payload/
zip -r tflix-ios.<version>.ipa Payload
```

**No Mac?** Run the **Build iOS app** workflow under the repo's *Actions* tab
(manual trigger — `.github/workflows/build-ios.yml`). It builds the unsigned IPA on a
GitHub macOS runner and uploads it as a downloadable artifact.

To change the app version, edit `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in
`TFLIX.xcodeproj/project.pbxproj` (both Debug and Release) — bump both on every release,
like `versionName`/`versionCode` on Android.

## iOS notes

- The site doesn't use safe-area CSS, so the WebView is pinned to the safe area —
  the strips around the notch / home indicator are painted in the site's background
  color (`#0a0a0d`) so nothing gets cropped and nothing looks letterboxed.
- Third-party cookies inside the stream `<iframe>`s are subject to WebKit's
  Intelligent Tracking Prevention, exactly like Safari on iOS — embeds that work in
  mobile Safari work here.
- On iPad, WebKit defaults to desktop-class browsing (like Safari on iPad), so the
  site renders its desktop layout.

## Project layout

| File | Purpose |
|------|---------|
| `TFLIX/MainViewController.swift` | The whole app — WKWebView, pop-up/ad blocking, origin pinning, fullscreen video, UA fix |
| `TFLIX/AppDelegate.swift` / `SceneDelegate.swift` | App entry point + single dark window |
| `TFLIX/Info.plist` | Display name, orientations, dark mode, launch screen color |
| `TFLIX/Assets.xcassets` | App icon (opaque 1024px) + launch background color |
| `TFLIX.xcodeproj` | Xcode project (shared scheme included, for CI builds) |
