/* ───────────────────────────────────────────────────────────────
   TFLIX Desktop — main-window preload

   Adds two desktop-only touches to the TFLIX site:
     • a small version label in the lower-left corner of browse pages
     • back-navigation state restore (Electron ships with bfcache off,
       so this rebuilds the open poster + scroll position on Back)

   Runs in the isolated world (contextIsolation: true): the DOM nodes
   and listeners created here can still talk to ipcRenderer directly.
   Only injects into the TOP frame — never inside the third-party
   stream embeds (which also receive this preload).
   ─────────────────────────────────────────────────────────────── */

const { ipcRenderer } = require('electron');

// App version. The preload is sandboxed (can't require package.json directly),
// so ask the main process for it synchronously.
let APP_VERSION = '';
try { APP_VERSION = ipcRenderer.sendSync('tflix:get-version') || ''; } catch {}

// Don't inject inside iframes (stream embeds, ad frames, etc.)
if (window.top === window.self) {
  const VER_ID = 'tflix-version-label';

  // The stream/player route has its own (often fullscreen) UI — keep the
  // version label out of the way there. It only belongs on the browse pages.
  function onStreamPage() {
    return /^\/stream(\/|$)/.test(window.location.pathname);
  }

  /* ─── Version label (lower-left corner of the main page) ─── */
  function injectVersion() {
    if (onStreamPage()) return;
    if (!APP_VERSION) return;
    if (document.getElementById(VER_ID)) return;        // already injected
    if (!document.body) return;

    const label = document.createElement('div');
    label.id = VER_ID;
    label.textContent = 'v' + APP_VERSION;

    Object.assign(label.style, {
      position: 'fixed',
      left: '14px',
      bottom: '12px',
      fontSize: '11px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      letterSpacing: '0.3px',
      color: 'rgba(244,244,247,0.35)',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '2147483646',
      opacity: '0',                       // hidden until scrolled to the bottom
      transition: 'opacity .25s',
    });

    document.body.appendChild(label);

    const atBottom = () => {
      const scrolled = window.scrollY + window.innerHeight;
      return scrolled >= document.documentElement.scrollHeight - 2;
    };
    const isScrollable = () =>
      document.documentElement.scrollHeight > window.innerHeight + 2;
    const modalOpen = () => !!document.querySelector('#modal-backdrop.open');
    const searchOpen = () =>
      !!document.querySelector('#search-results-section.visible');

    // Until the page has finished loading its content, treat a non-scrollable
    // page as "still loading" rather than "everything fits" — otherwise the
    // label flashes on open while the home rows are still being fetched.
    let settled = false;

    const update = () => {
      const show =
        !modalOpen() &&                       // hidden over an open poster
        !searchOpen() &&                      // hidden over search results
        atBottom() &&                         // only at the very bottom
        (isScrollable() || settled);          // suppress "fits" case until loaded
      label.style.opacity = show ? '1' : '0';
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    // Modal open/close and search show/hide only toggle CSS classes — no scroll
    // event — so watch the DOM to re-evaluate visibility.
    const mo = new MutationObserver(update);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    const settle = () => { settled = true; update(); };
    if (document.readyState === 'complete') setTimeout(settle, 1200);
    else window.addEventListener('load', () => setTimeout(settle, 1200));

    update();
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
  // (capture phase, so it runs before the page's handler navigates away). Also
  // remember whether the poster came from a search, plus the query + filter, so
  // we can rebuild the search results — not just the home page — on return.
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('#modal-watch-btn'))) return;
    try {
      var item = (typeof currentModalItem !== 'undefined') ? currentModalItem : null;
      if (!item) return;
      var ss = document.getElementById('season-select');
      var es = document.getElementById('episode-select');
      var input = document.getElementById('search');
      var results = document.getElementById('search-results-section');
      var isSearch = !!(results && results.classList.contains('visible'));
      var activeTab = document.querySelector('.filter-tab.active');
      sessionStorage.setItem(KEY, JSON.stringify({
        scrollY: window.scrollY,
        item: item,
        season: ss ? parseInt(ss.value || 1, 10) : 1,
        episode: es ? parseInt(es.value || 1, 10) : 1,
        search: (isSearch && input) ? input.value.trim() : null,
        filter: activeTab ? activeTab.dataset.filter : 'all'
      }));
    } catch (err) {}
  }, true);

  // If the bfcache ever does restore the page intact, drop the stale marker.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { try { sessionStorage.removeItem(KEY); } catch (err) {} }
  });

  // Content (home rows or search grid) loads lazily, so the page may be too
  // short at first — keep nudging the scroll to the saved spot until reached or
  // timeout, then fire the callback.
  function restoreScroll(targetY, done) {
    if (!targetY) { if (done) done(); return; }
    var deadline = Date.now() + 6000;
    (function step() {
      window.scrollTo(0, targetY);
      if (window.scrollY >= targetY - 2 || Date.now() >= deadline) { if (done) done(); return; }
      requestAnimationFrame(step);
    })();
  }

  // Reopen the poster. Resolves once the modal is fully open (and TV season/
  // episode reselected), i.e. after openModal has locked body overflow.
  function reopenModal(saved) {
    if (typeof openModal !== 'function') return Promise.resolve();
    return Promise.resolve(openModal(saved.item)).then(function () {
      var type = (typeof mediaOf === 'function') ? mediaOf(saved.item) : saved.item.media_type;
      if (type !== 'tv') return;
      var ss = document.getElementById('season-select');
      if (ss && saved.season != null) {
        ss.value = saved.season;
        if (typeof updateEpisodes === 'function') {
          return Promise.resolve(updateEpisodes(saved.item.id)).then(function () {
            var e2 = document.getElementById('episode-select');
            if (e2 && saved.episode != null) e2.value = saved.episode;
          });
        }
      }
      var es = document.getElementById('episode-select');
      if (es && saved.episode != null) es.value = saved.episode;
    });
  }

  // With the poster already open, settle the page underneath it. The open modal
  // locks body overflow (which clamps scrolling), so we briefly release it,
  // scroll into place, then re-lock — giving the "scroll in the background"
  // feel. Only re-lock if the modal is still open (user may have closed it).
  function settleScroll(saved) {
    var backdrop = document.getElementById('modal-backdrop');
    document.body.style.overflow = '';
    restoreScroll(saved.scrollY, function () {
      if (backdrop && backdrop.classList.contains('open')) document.body.style.overflow = 'hidden';
    });
  }

  function restore() {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (err) {}
    try { sessionStorage.removeItem(KEY); } catch (err) {}
    if (!saved || !saved.item) return;

    // Rebuild the background. Home is already loading; a poster opened from a
    // search needs the query (and filter) replayed. This runs concurrently with
    // the modal opening, so the poster still appears instantly.
    var bgReady;
    if (saved.search && typeof doSearch === 'function') {
      var input = document.getElementById('search');
      if (input) input.value = saved.search;
      var clearBtn = document.getElementById('search-clear');
      if (clearBtn) clearBtn.classList.add('visible');
      var filter = saved.filter || 'all';
      document.querySelectorAll('.filter-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.filter === filter);
      });
      try { if (typeof currentFilter !== 'undefined') currentFilter = filter; } catch (err) {}
      bgReady = Promise.resolve(doSearch(saved.search));
    } else {
      bgReady = Promise.resolve();
    }

    // Open the poster first; once it's open and the background is ready, scroll
    // the background into place behind it.
    reopenModal(saved).then(function () {
      bgReady.then(function () { settleScroll(saved); });
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
    injectVersion();
    injectHistoryRestore();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }
}
