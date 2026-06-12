/* ───────────────────────────────────────────────────────────────
   TFLIX iOS / iPadOS — the whole app

   A thin native shell around the live TFLIX website
   (https://tflix.nunesnetwork.com), the Apple counterpart of the
   Electron desktop app and the Android app. The WKWebView loads the
   deployed site directly, so any change to the site — new stream
   servers, fixed embeds — appears instantly, with no app update.

   The app's only job is ad-blocking:
     • every window.open / target=_blank is denied (createWebViewWith
       returns nil), so the popunder ads the stream embeds fire never
       open — except the site's Support link, which goes to Safari
     • the top frame is pinned to the TFLIX origin; the stream
       <iframe>s still navigate/redirect freely — blocking those
       breaks the embeds (same lesson as the other two apps)
   ─────────────────────────────────────────────────────────────── */

import UIKit
import WebKit

final class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private enum Site {
        static let url = URL(string: "https://tflix.nunesnetwork.com/")!
        static let origin = "https://tflix.nunesnetwork.com"

        // The site's Support button links here — the one pop-up we let
        // through, handed to Safari (same as the desktop and Android apps).
        static let supportURL = "https://github.com/TomasTNunes/tflix"
    }

    // Site background (#0a0a0d) — also the window/launch color, so the
    // safe-area strips around the WebView blend into the page.
    private static let background =
        UIColor(red: 0x0A / 255, green: 0x0A / 255, blue: 0x0D / 255, alpha: 1)

    private var webView: WKWebView!

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.background

        let config = WKWebViewConfiguration()

        // Persistent store keeps localStorage (the saved server choice)
        // across launches, like the other apps.
        config.websiteDataStore = .default()

        // The embeds' players start inline; don't force Apple's takeover
        // player or require a tap before media plays.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Fullscreen button inside the embeds' players (HTML Fullscreen API).
        if #available(iOS 15.4, *) {
            config.preferences.isElementFullscreenEnabled = true
        }

        // Present a plain-Safari User-Agent. The WKWebView default lacks the
        // "Version/… Safari/…" tokens, and some embed hosts reject
        // non-browser clients on that basis (same fix as the desktop app,
        // which strips the Electron tokens, and Android, which strips "; wv").
        // applicationNameForUserAgent replaces only the trailing app token,
        // so the OS/WebKit part of the UA still updates with the system.
        config.applicationNameForUserAgent = "Version/18.5 Mobile/15E148 Safari/604.1"

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self

        // Swipe from the edge = back/forward, the iOS counterpart of the
        // Android Back button (exit player → previous page).
        webView.allowsBackForwardNavigationGestures = true

        // Long-press link previews open a peek window outside our pop-up
        // guard — keep everything pinned inside the shell.
        webView.allowsLinkPreview = false

        // Avoid the white flash while the dark site loads.
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background

        // The site doesn't use safe-area CSS (no viewport-fit=cover), so pin
        // the WebView to the safe area instead of letting the notch / home
        // indicator crop the nav bar. The strips outside blend into the
        // matching background color.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
        ])

        webView.load(URLRequest(url: Site.url))
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Streaming app: don't let the screen sleep mid-episode
        // (FLAG_KEEP_SCREEN_ON on Android).
        UIApplication.shared.isIdleTimerDisabled = true
    }

    /* ─── Pop-up blocking (WKUIDelegate) ───
       Every window.open / target=_blank lands here. Returning nil denies
       the window — no popunder ad ever opens. Unlike Android, the URL is
       available directly, so no probe WebView is needed: the Support link
       goes to Safari, everything else is dropped without loading. */
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url,
           url.absoluteString.hasPrefix(Site.supportURL) {
            UIApplication.shared.open(url)
        }
        return nil
    }

    /* ─── Origin pinning (WKNavigationDelegate) ───
       Keep the top frame pinned to the TFLIX site: ad scripts sometimes
       try to hijack the whole page via top.location = adURL. WebKit asks
       this policy again for every server-side redirect hop, so those are
       covered too (the desktop app's will-navigate + will-redirect pair).

       IMPORTANT: only guard the MAIN frame. The third-party stream
       <iframe>s legitimately navigate and redirect cross-origin to load
       their players — blocking those leaves the embeds broken. */
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if let frame = navigationAction.targetFrame, frame.isMainFrame,
           let url = navigationAction.request.url,
           !url.absoluteString.hasPrefix(Site.origin) {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    /* ─── Resilience ───
       iOS kills the WebKit process under memory pressure in the background;
       without this the user comes back to a blank view. */
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    /* ─── iPad hardware keyboard: ⌘R reloads, like the desktop app ─── */
    override var keyCommands: [UIKeyCommand]? {
        [UIKeyCommand(title: "Reload", action: #selector(reloadPage),
                      input: "r", modifierFlags: .command)]
    }

    @objc private func reloadPage() {
        webView.reload()
    }
}
