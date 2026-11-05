/* ───────────────────────────────────────────────────────────────
   TFLIX Android — version label

   The Android twin of the label app/windows/preload-main.js adds: a
   small "v1.2.3" in the lower-left corner of the browse pages, shown
   only once you scroll to the very bottom. The site's Get Apps menu
   also reads it to tell whether this install is out of date.

   MainActivity runs this in the top frame after every page load,
   with the version placeholder below replaced by the app's versionName.
   ─────────────────────────────────────────────────────────────── */
(function () {
  var VERSION = '__APP_VERSION__';
  var ID = 'tflix-version-label';

  // The player has its own (often fullscreen) UI — browse pages only.
  if (/^\/stream(\/|$)/.test(location.pathname)) return;
  if (!VERSION || !document.body || document.getElementById(ID)) return;

  var label = document.createElement('div');
  label.id = ID;
  label.textContent = 'v' + VERSION;
  var st = label.style;
  st.position = 'fixed';
  st.left = '14px';
  st.bottom = '12px';
  st.fontSize = '11px';
  st.fontFamily = 'system-ui, -apple-system, sans-serif';
  st.letterSpacing = '0.3px';
  st.color = 'rgba(244,244,247,0.35)';
  st.pointerEvents = 'none';
  st.userSelect = 'none';
  st.zIndex = '2147483646';
  st.opacity = '0';                       // hidden until scrolled to the bottom
  st.transition = 'opacity .25s';
  document.body.appendChild(label);

  function atBottom() {
    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  }
  function isScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }
  function modalOpen() { return !!document.querySelector('#modal-backdrop.open'); }
  function searchOpen() { return !!document.querySelector('#search-results-section.visible'); }

  // Until the home rows have loaded, a page that fits the screen is just
  // "still loading" — don't flash the label on open.
  var settled = false;

  function update() {
    var show = !modalOpen() && !searchOpen() && atBottom() && (isScrollable() || settled);
    label.style.opacity = show ? '1' : '0';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  // Opening a poster or a search only toggles classes — no scroll event.
  new MutationObserver(update).observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'],
  });

  function settle() { settled = true; update(); }
  if (document.readyState === 'complete') setTimeout(settle, 1200);
  else window.addEventListener('load', function () { setTimeout(settle, 1200); });

  update();
})();
