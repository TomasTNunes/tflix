/* ───────────────────────────────────────────────────────────────
   TFLIX Android — keeps the player usable inside the stream embeds

   MainActivity runs this before any page script, in every frame.
   It only acts inside the embeds, never on the TFLIX site itself.

   Same click fix as the Windows app (app/windows/preload-main.js):
   popunder scripts catch every tap on window/document in the capture
   phase, cancel it and try to open their ad, then re-arm a few seconds
   later — so on Naafiri tap after tap never reaches the player. Cancelling
   a real tap at that outermost capture stage is made a no-op here. The
   ad's window still goes nowhere (onCreateWindow in MainActivity), and the
   player's own handlers further in are untouched.
   ─────────────────────────────────────────────────────────────── */
(function () {
  if (window.top === window.self) return;

  /* Script blocker. An ad needs code running in the page to draw itself, while
     video and subtitles are only data. So an embed may run its own scripts and
     the libraries below, and no script from anywhere else, whatever its domain:
     ad domains change within hours, and so do the embeds' video domains, which
     is why data stays open to every domain.

     The libraries are the players' real ones: hls.js (Xayah), JW Player (Ryze)
     and Chromecast (Xayah, Naafiri, Ekko). If a server stops working with a
     "Refused to load the script" error, its script belongs in this list. */
  var SCRIPT_LIBRARIES = 'https://cdn.jsdelivr.net https://cdn.jwplayer.com https://*.gstatic.com';
  var POLICY = "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: " + SCRIPT_LIBRARIES + '; worker-src * blob: data:';

  function addPolicy() {
    var meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = POLICY;
    document.head.insertBefore(meta, document.head.firstChild);
  }
  // At document start the <head> may not exist yet: add the rule the moment it does.
  if (document.head) {
    addPolicy();
  } else {
    var waitForHead = new MutationObserver(function () {
      if (!document.head) return;
      waitForHead.disconnect();
      addPolicy();
    });
    waitForHead.observe(document, { childList: true, subtree: true });
  }

  ['preventDefault', 'stopPropagation', 'stopImmediatePropagation'].forEach(function (method) {
    var original = Event.prototype[method];
    Event.prototype[method] = function () {
      var swallowingTap =
        this.isTrusted &&
        (this.type === 'click' || this.type === 'touchend') &&
        this.eventPhase === Event.CAPTURING_PHASE &&
        (this.currentTarget === window || this.currentTarget === document);
      if (!swallowingTap) return original.apply(this, arguments);
    };
  });

  /* The players on Xayah and Ryze keep laying a transparent, full-size ad link
     over the video (their PopUnder code, id "dontfoid"), which takes the next
     tap. Hide it. A stylesheet, because this runs before there is a page to
     find the link in, and the link is added and removed all the time. */
  try {
    var sheet = new CSSStyleSheet();
    sheet.replaceSync('#dontfoid { display: none !important; }');
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet);
  } catch (e) {}
})();
