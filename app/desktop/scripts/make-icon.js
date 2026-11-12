/* Generates the app icons from the existing PNG icon set in ../../assets/icons:
     • build/icon.ico — the Windows executable + installer, and the window
       icon on Windows (in dev)
     • build/icons/<size>x<size>.png — the Linux menu icons (one file per
       size, named as electron-builder wants them); 256x256 is also the
       window icon on Linux */

const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const ASSETS = path.join(__dirname, '..', '..', '..', 'assets', 'icons');
const OUT_DIR = path.join(__dirname, '..', 'build');
const OUT = path.join(OUT_DIR, 'icon.ico');
const OUT_PNGS = path.join(OUT_DIR, 'icons');

// .ico supports sizes up to 256px — exclude icon_1024.png.
// electron-builder requires at least one 256x256 image in the .ico.
const SIZES = ['16', '32', '48', '64', '128', '256'];

// Linux takes every size, 1024px included.
const PNG_SIZES = [...SIZES, '1024'];

(async () => {
  try {
    const sources = SIZES
      .map((s) => path.join(ASSETS, `icon_${s}.png`))
      .filter((f) => fs.existsSync(f));

    if (!sources.length) {
      console.warn('[make-icon] No source PNGs found in', ASSETS, '— skipping.');
      return;
    }

    const buf = await pngToIco(sources);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT, buf);
    console.log('[make-icon] Wrote', OUT, `(${sources.length} sizes)`);

    fs.mkdirSync(OUT_PNGS, { recursive: true });
    const pngs = PNG_SIZES.filter((s) => fs.existsSync(path.join(ASSETS, `icon_${s}.png`)));
    for (const s of pngs) {
      fs.copyFileSync(path.join(ASSETS, `icon_${s}.png`), path.join(OUT_PNGS, `${s}x${s}.png`));
    }
    console.log('[make-icon] Wrote', OUT_PNGS, `(${pngs.length} sizes)`);
  } catch (err) {
    console.error('[make-icon] Failed:', err.message);
    process.exitCode = 1;
  }
})();
