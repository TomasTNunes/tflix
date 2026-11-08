
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
- 🖥️ Use it as a native **Windows desktop app** or **Android app** (phone + TV) with no ads —
  download them from **Get Apps** in the profile menu

## Desktop App (Windows)

Prefer a real app over a browser tab? TFLIX is also available as a native **Windows desktop app**.

- 🪟 Runs in its own window — no browser needed
- 🚫 Blocks the pop-ups and ad redirects (No Ads)
- 🔄 Always up to date — loads the live site, so new servers and fixes appear instantly
- ✅ No setup — no API token to enter, just install and open

📥 Download it from **Get Apps** in the site's profile menu, or from the [latest release](https://github.com/TomasTNunes/tflix/releases/latest).

🔄 Already installed? The app tells you when an update is out (a pop-up when it opens, and a yellow dot on the profile icon). Click **Update** in Get Apps and run the new installer over the old version — no uninstall needed. See [Update](app/windows/README.md#update) for details.

👉 See the [Windows app guide](app/windows/README.md) for more info.

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

🔄 Already installed? The app tells you when an update is out. Tap **Update** in Get Apps: the APK downloads without a browser, then tap the finished download to install it over the old version (on Android TV the installer opens by itself; the first time, allow the install source and tap **Update** again) — no uninstall needed. See [Update](app/android/README.md#update) for details.

👉 See the [Android app guide](app/android/README.md) for more info.

## Tech Stack

- HTML, CSS, JavaScript
- [Electron](https://www.electronjs.org/) (Windows desktop app)
- [Kotlin](https://kotlinlang.org/) (Android phone + TV app)
- [TMDB API](https://developers.themoviedb.org/)
- [Firebase](https://firebase.google.com/) (accounts + My List and Continue Watching sync)
- [GitHub Pages](https://pages.github.com/)
