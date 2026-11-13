
<div align="center">
  <img src="assets/tflix-banner.svg" alt="TFLIX" />
</div>
<br/>

[TFLIX](https://tflix.stream/) is a simple movie and TV show search website powered by the TMDB API.
It lets users discover movies and TV shows and stream them directly within the website.

🌐 Live: [tflix.stream](https://tflix.stream/)

> **Alternative**: [TMDB-Player](https://github.com/TomasTNunes/TMDB-Player) — an open-source browser extension that lets you stream your favorite movies and TV shows directly through the TMDB website.

## Features

- 🔍 Search movies and TV shows from TMDB
- 📄 View details such as title, release date, and poster
- ▶️ Stream directly within TFLIX
- 📡 Choose from multiple predefined streaming servers
- ⏯️ **Continue Watching** picks up where you stopped, on the right episode
- ➕ Save titles to **My List**, optionally synced across devices with a free account
- 📅 **Calendar** of upcoming episodes and digital releases for titles in your list
- 🖥️ Use it as a native **Windows or Linux desktop app** or **Android app** (phone + TV) with no ads —
  download them from **Get Apps** in the profile menu
- 🍎 On **iPhone, iPad and Mac**, add TFLIX to the Home Screen or Dock to open it like an app

## Desktop App (Windows & Linux)

Prefer a real app over a browser tab? TFLIX is also available as a native **desktop app for Windows and Linux** (Linux: a `.deb` for Ubuntu, Debian and Mint, or an AppImage for any distro — for Intel/AMD or ARM64).

- 🪟 Runs in its own window — no browser needed
- 🚫 Blocks the pop-ups and ad redirects (No Ads)
- 🔄 Always up to date — loads the live site, so new servers and fixes appear instantly
- ✅ No setup — no API token to enter, just install and open

📥 Download it from **Get Apps** in the site's profile menu, or from the [latest release](https://github.com/TomasTNunes/tflix/releases/latest).

🛡️ On Windows, the installer isn't code-signed, so the browser may say it "isn't commonly downloaded" (choose **Keep**) and Windows may show **Windows protected your PC** (click **More info → Run anyway**). The same applies when updating.

🔄 Already installed? The app tells you when an update is out (a pop-up when it opens, and a yellow dot on the profile icon). Click **Update** in Get Apps and install the new version over the old one — no uninstall needed. See the update steps for [Windows](app/desktop/README.md#update) and [Linux](app/desktop/README.md#update-1).

👉 See the [desktop app guide](app/desktop/README.md) for more info.

## Android App (Phone + Android TV)

TFLIX is also available as a native **Android app** — one APK that works on phones,
tablets, and **Android TV** (it shows up in the TV launcher).

- 📱 Runs in its own app — no browser needed
- 🚫 Blocks the pop-ups and ad redirects (No Ads)
- 🔄 Always up to date — loads the live site, so new servers and fixes appear instantly
- 📺 Android TV ready — installs and launches from the Leanback launcher

📥 Download the APK from **Get Apps** in the site's profile menu, or from the
[latest release](https://github.com/TomasTNunes/tflix/releases/latest), and sideload it
(on TV: install via a file-manager app or `adb install`).

🛡️ If Google Play Protect warns about or blocks the install or an update, select **More details** (or **More info**) and choose **Install anyway**.

🔄 Already installed? The app tells you when an update is out. Tap **Update** in Get Apps: the APK downloads without a browser, then tap the finished download to install it over the old version (on Android TV the installer opens by itself; the first time, allow the install source and tap **Update** again) — no uninstall needed. See [Update](app/android/README.md#update) for details.

👉 See the [Android app guide](app/android/README.md) for more info.

## iPhone, iPad & Mac

There's no native Apple app, but you can add the website to your **Home Screen** (iPhone and iPad)
or **Dock** (Mac, Safari on macOS Sonoma or later) so it opens in its own window, like an app.

- 📲 **iPhone / iPad:** in Safari, tap **Share → Add to Home Screen** (on iOS 26, tap **•••** first), turn on **Open as Web App** if you see it, then tap **Add**
- 💻 **Mac:** in Safari, choose **File → Add to Dock**, then click **Add**

⚠️ Unlike the other apps, this doesn't block the servers' ads. To block most of them, use
**AdGuard DNS** on iPhone and iPad (the profile downloads from **Get Apps**) or a Safari ad blocker on Mac.

📥 The full steps, with screenshots, are in **Get Apps → iPhone, iPad & Mac → How to Add** in the site's profile menu.

👉 See the [Apple guide](app/apple/README.md) for more info.

## Tech Stack

- HTML, CSS, JavaScript
- [Electron](https://www.electronjs.org/) (Windows and Linux desktop app)
- [Kotlin](https://kotlinlang.org/) (Android phone + TV app)
- [TMDB API](https://developers.themoviedb.org/)
- [Firebase](https://firebase.google.com/) (accounts + My List and Continue Watching sync)
- [GitHub Pages](https://pages.github.com/)
