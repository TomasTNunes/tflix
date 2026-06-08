/* ───────────────────────────────────────────────────────────────
   TFLIX Desktop — main-window preload

   Injects a small floating "settings" (gear) button into the TFLIX
   site so users can re-open the token setup window from inside the
   app, without hunting through the hidden menu bar.

   Runs in the isolated world (contextIsolation: true): the DOM nodes
   and listeners created here can still talk to ipcRenderer directly.
   Only injects into the TOP frame — never inside the third-party
   stream embeds (which also receive this preload).
   ─────────────────────────────────────────────────────────────── */

const { ipcRenderer } = require('electron');

// Don't inject inside iframes (stream embeds, ad frames, etc.)
if (window.top === window.self) {
  const BTN_ID = 'tflix-settings-btn';

  // The stream/player route has its own (often fullscreen) UI — keep the
  // gear out of the way there. The button only belongs on the browse pages.
  function onStreamPage() {
    return /^\/stream(\/|$)/.test(window.location.pathname);
  }

  function injectButton() {
    if (onStreamPage()) return;
    if (document.getElementById(BTN_ID)) return;       // already injected
    if (!document.body) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = 'Change TMDB Token';
    btn.setAttribute('aria-label', 'Change TMDB Token');

    // Gear icon (inline SVG so it needs no external asset)
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"></circle>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
      '</svg>';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      width: '42px',
      height: '42px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(20,20,26,0.72)',
      color: '#f4f4f7',
      cursor: 'pointer',
      zIndex: '2147483647',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
      opacity: '0.45',
      transition: 'opacity .2s, background .2s, transform .2s',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.background = 'rgba(229,9,20,0.9)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.45';
      btn.style.background = 'rgba(20,20,26,0.72)';
    });
    btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.92)'; });
    btn.addEventListener('mouseup',   () => { btn.style.transform = 'scale(1)'; });

    btn.addEventListener('click', () => {
      ipcRenderer.send('tflix:open-settings');
    });

    document.body.appendChild(btn);
  }

  /* ─── Back-navigation state restore (desktop app only) ───
     On the website the browser's bfcache restores the browse page (scroll
     position + open poster) when you press Back from the player. Electron
     ships with the bfcache disabled, so history.back() does a fresh reload
     and that state is lost.

     Rather than edit the shared site files, we inject a tiny classic <script>
     into the page's MAIN world. Running there (not the isolated preload world)
     lets it reuse the site's own globals — currentModalItem, openModal,
     mediaOf, updateEpisodes — to save state on "Watch" and rebuild it on the
     reload that Back triggers. The deployed website never gets this script, so
     its native bfcache behaviour is unchanged. */
  const HISTORY_INJECT = `
(function () {
  var KEY = 'tflix_return';
  var onStream = /^\\/stream(\\/|$)/.test(location.pathname);

  if (onStream) {
    // Logo = fresh home: discard any saved poster/scroll so it won't reopen.
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#logo')) {
        try { sessionStorage.removeItem(KEY); } catch (err) {}
      }
    }, true);
    return;
  }

  // Browse page: capture scroll + the open poster when the user hits Watch
  // (capture phase, so it runs before the page's handler navigates away).
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('#modal-watch-btn'))) return;
    try {
      var item = (typeof currentModalItem !== 'undefined') ? currentModalItem : null;
      if (!item) return;
      var ss = document.getElementById('season-select');
      var es = document.getElementById('episode-select');
      sessionStorage.setItem(KEY, JSON.stringify({
        scrollY: window.scrollY,
        item: item,
        season: ss ? parseInt(ss.value || 1, 10) : 1,
        episode: es ? parseInt(es.value || 1, 10) : 1
      }));
    } catch (err) {}
  }, true);

  // If the bfcache ever does restore the page intact, drop the stale marker.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { try { sessionStorage.removeItem(KEY); } catch (err) {} }
  });

  // Rows load lazily, so the page may be too short at first — keep nudging the
  // scroll to the saved spot as content streams in, until reached or timeout.
  function restoreScroll(targetY) {
    if (!targetY) return;
    var deadline = Date.now() + 6000;
    (function step() {
      window.scrollTo(0, targetY);
      if (window.scrollY < targetY - 2 && Date.now() < deadline) requestAnimationFrame(step);
    })();
  }

  function restore() {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (err) {}
    try { sessionStorage.removeItem(KEY); } catch (err) {}
    if (!saved || !saved.item || typeof openModal !== 'function') return;

    restoreScroll(saved.scrollY);

    Promise.resolve(openModal(saved.item)).then(function () {
      var type = (typeof mediaOf === 'function') ? mediaOf(saved.item) : saved.item.media_type;
      var es = document.getElementById('episode-select');
      if (type !== 'tv') return;
      var ss = document.getElementById('season-select');
      if (ss && saved.season != null) {
        ss.value = saved.season;
        if (typeof updateEpisodes === 'function') {
          Promise.resolve(updateEpisodes(saved.item.id)).then(function () {
            var e2 = document.getElementById('episode-select');
            if (e2 && saved.episode != null) e2.value = saved.episode;
          });
          return;
        }
      }
      if (es && saved.episode != null) es.value = saved.episode;
    });
  }

  restore();
})();
`;

  function injectHistoryRestore() {
    if (document.getElementById('tflix-history-inject')) return;
    const root = document.documentElement;
    if (!root) return;
    const s = document.createElement('script');
    s.id = 'tflix-history-inject';
    s.textContent = HISTORY_INJECT;
    root.appendChild(s);   // classic script → runs in the page's main world
    s.remove();
  }

  function injectAll() {
    injectButton();
    injectHistoryRestore();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }
}
