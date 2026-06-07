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

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
}
