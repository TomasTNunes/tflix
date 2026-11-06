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
     and Chromecast (Xayah, Naafiri, Ekko). MainActivity fills them in from
     scriptLibraries in app-lists.json. If a server stops working with a "Refused
     to load the script" error, its script belongs in that list, on the site. */
  var SCRIPT_LIBRARIES = '__SCRIPT_LIBRARIES__';
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

  /* The players on Xayah and Ryze keep laying a transparent, full-size ad link
     over the video (their PopUnder code, id "dontfoid"), which takes the next
     tap. Hide it. A stylesheet, because this runs before there is a page to
     find the link in, and the link is added and removed all the time. */
  try {
    var sheet = new CSSStyleSheet();
    sheet.replaceSync('#dontfoid { display: none !important; }');
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet);
  } catch (e) {}

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

  /* TV: tell the cursor when it's over something clickable, so it can change look.
     Only MainActivity's listener provides window.tflixCursor. Something covering
     most of the player doesn't count: some players make the whole video clickable,
     and then the cursor would never look plain. */
  if (window.tflixCursor) {
    var CLICKABLE = 'a[href],button,input,select,label,summary,[onclick],[role=button],' +
      '[role=link],[role=menuitem],[role=menuitemradio],[role=option],[role=slider],[role=tab]';
    var overClickable = false;
    var report = function (clickable) {
      if (clickable === overClickable) return;
      overClickable = clickable;
      window.tflixCursor.postMessage(clickable ? 'clickable' : 'plain');
    };
    var isClickable = function (el) {
      if (!el || !el.closest) return false;
      var target = el.closest(CLICKABLE);
      if (!target) {
        if (getComputedStyle(el).cursor !== 'pointer') return false;
        target = el;
      }
      var r = target.getBoundingClientRect();
      return r.width * r.height < window.innerWidth * window.innerHeight * 0.5;
    };
    window.addEventListener('mousemove', function (e) { report(isClickable(e.target)); }, true);
    window.addEventListener('mouseout', function (e) { if (!e.relatedTarget) report(false); }, true);
  }

  /* The TV remote's media keys (MainActivity sends these down to the embed). The
     video may be in a nested iframe, so each frame also passes them further in.
     Some players relay every message to their own iframes as well, so one key
     press can arrive several times: each press has an id, and repeats are ignored. */
  var SKIP_SECONDS = 10;
  window.addEventListener('message', function (e) {
    var command = e.data && e.data.tflixPlayer;
    if (!command || e.source !== window.parent) return;
    if (window.__tflixLastPress === e.data.press) return;
    window.__tflixLastPress = e.data.press;
    var video = null, largest = 0;
    document.querySelectorAll('video').forEach(function (v) {
      var r = v.getBoundingClientRect(), area = r.width * r.height;
      if (area > largest) { largest = area; video = v; }
    });
    if (video) {
      if (command === 'toggle') { if (video.paused) video.play(); else video.pause(); }
      else if (command === 'play') video.play();
      else if (command === 'pause') video.pause();
      else if (command === 'forward') video.currentTime += SKIP_SECONDS;
      else if (command === 'rewind') video.currentTime -= SKIP_SECONDS;
    }
    for (var i = 0; i < window.frames.length; i++) window.frames[i].postMessage(e.data, '*');
  });
})();
