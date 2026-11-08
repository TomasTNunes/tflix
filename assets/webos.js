/* ───────────────────────────────────────────────────────────────
   TFLIX LG webOS — coming back from the player

   The webOS app hands the whole page to the site, so unlike the Windows
   and Android apps it can't add scripts of its own. index.html loads this
   only inside that app (<html data-app="webos">).

   A TV may rebuild the home page when Back leaves the player. So the page
   notes where things were as it's left, and when Back returns to it puts
   back the search, the open title with its season and episode, the scroll
   position and the card the remote was on. Starting TFLIX, or going home
   from the player's logo, is a normal navigation and starts fresh.

   Runs on the main page, using its globals (openModal, doSearch, …).
   ─────────────────────────────────────────────────────────────── */
(function () {
  const KEY = 'tflix_return';
  const WAIT = 6000;   // ms to wait for the lazily loaded rows
  const SETTLE = 300;  // ms the page's height must hold still to count as loaded

  function save() {
    try {
      const card = window.__knavCard();
      sessionStorage.setItem(KEY, JSON.stringify({
        scrollY: window.scrollY,
        item: modalIsOpen() ? currentModalItem : null,
        season: $('season-select')?.value,
        episode: $('episode-select')?.value,
        search: $('search-results-section').classList.contains('visible') ? searchInput.value.trim() : null,
        filter: currentFilter,
        keynav: !!document.querySelector('.keynav'),
        cardKey: card?.dataset.key || null,
        cardTop: card ? card.getBoundingClientRect().top + window.scrollY : 0,
      }));
    } catch {}
  }

  function setPicker(id, value) {
    const sel = $(id);
    if (value == null || sel.value === value) return false;
    if (![...sel.options].some(o => o.value === value)) return false;
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
    return true;
  }

  async function reopenTitle(saved) {
    await openModal(saved.item);
    if (mediaOf(saved.item) !== 'tv') return;
    await tvLoad;
    if (setPicker('season-select', saved.season)) await tvLoad;
    setPicker('episode-select', saved.episode);
  }

  function replaySearch(saved) {
    searchInput.value = saved.search;
    clearBtn.classList.add('visible');
    currentFilter = saved.filter || 'all';
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === currentFilter));
    return doSearch(saved.search);
  }

  // The page's smooth scrolling would restart on every try, so jump. Rows load
  // lazily: the page may still be too short, and as they fill in the browser
  // moves the scroll position with them. So hold it until the page has settled,
  // or until the viewer does anything, who then decides where the page goes.
  function restoreScroll(y) {
    const modalOpen = modalIsOpen();
    if (modalOpen) document.body.style.overflow = document.documentElement.style.overflow = '';
    const deadline = Date.now() + WAIT;
    const inputs = ['keydown', 'mousedown', 'wheel'];
    let touched = false, height = 0, heightSince = 0;
    const touch = () => { touched = true; };
    inputs.forEach(ev => window.addEventListener(ev, touch, true));
    return new Promise(resolve => {
      (function step() {
        const now = Date.now();
        if (!touched) window.scrollTo({ top: y, behavior: 'instant' });
        const h = document.documentElement.scrollHeight;
        if (h !== height) { height = h; heightSince = now; }
        const settled = window.scrollY >= y - 2 && !document.querySelector('.skeleton') && now - heightSince > SETTLE;
        if (touched || settled || now >= deadline) {
          inputs.forEach(ev => window.removeEventListener(ev, touch, true));
          if (modalOpen && modalIsOpen()) document.body.style.overflow = document.documentElement.style.overflow = 'hidden';
          resolve();
        } else requestAnimationFrame(step);
      })();
    });
  }

  // A title can be on several rows: take the one it was on, or nearest to it
  function findCard(saved) {
    const deadline = Date.now() + WAIT;
    return new Promise(resolve => {
      (function step() {
        const cards = [...document.querySelectorAll(`.card[data-key="${saved.cardKey}"]`)];
        if (cards.length || Date.now() >= deadline) {
          const place = c => Math.abs(c.getBoundingClientRect().top + window.scrollY - saved.cardTop);
          resolve(cards.sort((a, b) => place(a) - place(b))[0] || null);
        } else requestAnimationFrame(step);
      })();
    });
  }

  async function restore(saved) {
    const search = saved.search ? replaySearch(saved) : null;
    if (saved.item) await reopenTitle(saved);
    await search;
    if (saved.scrollY) await restoreScroll(saved.scrollY);
    if (saved.keynav) window.__knavResume(saved.cardKey ? await findCard(saved) : null);
  }

  let saved = null;
  try {
    const [nav] = performance.getEntriesByType('navigation');
    if (nav?.type === 'back_forward') saved = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch {}
  if (saved) restore(saved).catch(err => console.warn('Could not restore the page', err));

  window.addEventListener('pagehide', save);
})();
