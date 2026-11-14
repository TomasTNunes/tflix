#!/bin/sh
# Starts TFLIX inside the Flatpak. zypak-wrapper (from the Electron BaseApp)
# lets Chromium's sandbox work inside Flatpak's own, where setuid and new user
# namespaces aren't allowed. CHROME_DESKTOP names the desktop file, so on
# Wayland the window gets the TFLIX icon (the app itself says tflix.desktop).
export CHROME_DESKTOP=stream.tflix.TFLIX.desktop
exec zypak-wrapper /app/tflix/tflix "$@"
