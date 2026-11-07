/* ─── HELP (FAQ) ───
   Shared by the main page (profile menu → Help) and the stream page (Help
   button), so the answers only live here. Each page styles the list itself.
   renderFaq(el) fills el with question buttons that expand their answer,
   one open at a time. */
const TFLIX_ISSUES_URL = 'https://github.com/TomasTNunes/tflix/issues';

const TFLIX_FAQ = [
  ["The video won't play or keeps loading",
   "Pick another server. Each one pulls the video from a different source, so a title missing on one is often on another. On the watch page they're listed under the player; on the home page use the server button at the top."],
  ['Why do pop-ups or new tabs open?',
   "They come from the streaming servers, not from TFLIX. Close them and go back to the video. The Windows and Android apps block them: get them from <b>Get Apps</b> in the profile menu. In a browser, an ad blocker such as uBlock Origin helps."],
  ['How do I get subtitles or another language?',
   'Most players have a subtitles (CC) or settings button in their controls. Some servers also let you upload your own subtitle file. If the language you need is missing, try another server.'],
  ['How does Continue Watching work?',
   "Once you've watched a title for about 30 seconds, or skipped ahead in it, it appears in <b>Continue Watching</b> on the home page, and its card takes you back to where you stopped. A finished movie leaves the row, and a finished episode moves the show on to the next one. If a server doesn't report your position, you'll still get back to the right episode, but from its start. On a card, <b>ⓘ</b> shows the title's details and <b>✕</b> removes it."],
  ['Do I need an account?',
   "No. Without one, My List and Continue Watching are saved in this browser only. A free account keeps them in sync on every device, including the apps. You can sign up with just a username, or with an email if you'd like to be able to reset your password."],
  ['I forgot my password',
   "Use <b>Forgot password?</b> on the sign-in screen to get a reset link by email. Accounts made with only a username have no email to send it to, so add one in <b>My Account</b> while you're still signed in."],
  ["What's in the Calendar?",
   'New episodes and digital releases for the titles in your My List, so add a show or movie there to see its dates.'],
  ['Is there an app?',
   'Yes, for Windows and for Android (phones, tablets and Android TV). The apps block the pop-ups and ad redirects, and they always load the latest version of TFLIX. Get them from <b>Get Apps</b> in the profile menu.'],
  ['Can I watch on a TV?',
   'Yes. The Android app also runs on Android TV and works with the remote: the arrows move around and OK selects. Get it from <b>Get Apps</b> in the profile menu.'],
  ['How do I update the app?',
   'When a new version is out, the app shows a notice and the profile icon gets a yellow dot. Open <b>Get Apps</b>, press <b>Update</b> and install it over the old version. There\'s no need to uninstall.'],
];

function renderFaq(el) {
  const chevron = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
  el.innerHTML = TFLIX_FAQ.map(([q, a], i) => `
    <div class="faq-item">
      <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-${i}"><span>${q}</span>${chevron}</button>
      <div class="faq-a" id="faq-a-${i}" hidden>${a}</div>
    </div>`).join('');
  el.addEventListener('click', e => {
    const btn = e.target.closest('.faq-q');
    if (!btn) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    collapseFaq(el);
    btn.setAttribute('aria-expanded', open);
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
  });
}

function collapseFaq(el) {
  el.querySelectorAll('.faq-q').forEach(b => {
    b.setAttribute('aria-expanded', 'false');
    document.getElementById(b.getAttribute('aria-controls')).hidden = true;
  });
}
