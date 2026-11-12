/* Renames the Linux builds in dist/ to one CPU name each: x64 or arm64.
   electron-builder's ${arch} follows each format's own habit (AppImage:
   x86_64, .deb: amd64), but the release files and the site's Get Apps
   (APP_ASSETS in index.html) use tflix-linux.<version>.<x64|arm64>.<ext>.
   Renaming is safe: neither format reads its own file name. */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const CPU = { x86_64: 'x64', amd64: 'x64', aarch64: 'arm64' };

for (const name of fs.existsSync(DIST) ? fs.readdirSync(DIST) : []) {
  const m = name.match(/^(tflix-linux\.\d+(?:\.\d+)*\.)(x86_64|amd64|aarch64)(\.(?:AppImage|deb))$/);
  if (!m) continue;
  const renamed = m[1] + CPU[m[2]] + m[3];
  fs.renameSync(path.join(DIST, name), path.join(DIST, renamed));
  console.log('[linux-names]', name, '→', renamed);
}
