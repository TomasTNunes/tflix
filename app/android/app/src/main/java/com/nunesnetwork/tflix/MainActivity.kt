/* ───────────────────────────────────────────────────────────────
   TFLIX Android — phone + Android TV

   A thin native shell around the live TFLIX website
   (https://tflix.stream), the Android counterpart of the
   Electron desktop app. The WebView loads the deployed site directly,
   so any change to the site — new stream servers, fixed embeds —
   appears instantly, with no app update.

   The app's only job is ad-blocking:
     • every window.open / target=_blank is denied (onCreateWindow),
       so the popunder ads the stream embeds fire never open — except
       the site's Support link, which opens in the system browser, and
       the Get Apps download links, which the system Download Manager
       saves to Downloads (notification → tap to install/update)
     • the top frame is pinned to the TFLIX origin; the stream
       <iframe>s still navigate/redirect freely — blocking those
       breaks the embeds (same lesson as the desktop app)
     • requests to the ad networks in app-lists.json come back empty,
       so their in-player ads have nothing to show (AppLists.kt keeps
       the list up to date from the site)
     • assets/embed-guard.js keeps ad scripts and invisible ad links
       from swallowing taps on the players

   It also adds the desktop app's small version label to the browse
   pages (assets/version-label.js), which the site's Get Apps menu
   reads to offer an update.
   ─────────────────────────────────────────────────────────────── */

package com.nunesnetwork.tflix

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.UiModeManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream

class MainActivity : Activity() {

    companion object {
        // The app's own address: Cloudflare redirects it (302, so it's
        // rechecked on every launch) to https://tflix.stream/?app=android.
        // Pointing that redirect elsewhere retires or redirects every
        // installed copy without an app update.
        private const val SITE_URL = "https://appandroid.tflix.stream/"

        // The top frame may navigate anywhere on these domains or their
        // subdomains (over HTTPS) — the old and new TFLIX domains, so moving
        // between them and the redirect from one to the other keep working.
        private val ALLOWED_DOMAINS = listOf("nunesnetwork.com", "tflix.stream")

        private fun isAllowedSite(uri: Uri): Boolean {
            val host = uri.host ?: return false
            return uri.scheme == "https" && ALLOWED_DOMAINS.any { host == it || host.endsWith(".$it") }
        }

        // The site's Support button links here — the one pop-up we let
        // through, handed to the system browser (same as the desktop app).
        private const val SUPPORT_URL = "https://github.com/TomasTNunes/tflix"

        // Release files (the site's Get Apps buttons) live under here. They're
        // downloaded in place instead of opening a browser, which many TVs lack.
        private const val RELEASE_DOWNLOAD_URL = "$SUPPORT_URL/releases/download/"
    }

    private lateinit var webView: WebView

    /* The version label script, with this install's version filled in */
    private val versionLabelJs: String by lazy {
        @Suppress("DEPRECATION")
        val version = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        assets.open("version-label.js").bufferedReader().use { it.readText() }
            .replace("__APP_VERSION__", version)
    }

    /* The ad hosts to answer with nothing and the embeds' script libraries */
    private lateinit var lists: AppLists

    /* The script run inside the embeds, while it's installed */
    private var embedGuard: ScriptHandler? = null

    /* The host itself or any domain it's under: x.y.ads.com matches ads.com */
    private fun isAdHost(host: String?): Boolean {
        var h = host ?: return false
        val adHosts = lists.adHosts
        while (true) {
            if (h in adHosts) return true
            val dot = h.indexOf('.')
            if (dot < 0) return false
            h = h.substring(dot + 1)
        }
    }

    private val embedGuardJs: String by lazy {
        assets.open("embed-guard.js").bufferedReader().use { it.readText() }
    }

    /* TV: APK downloads whose installer opens as soon as they finish */
    private val pendingInstalls = mutableSetOf<Long>()
    private var downloadReceiver: BroadcastReceiver? = null

    /* TVs only: the remote-driven cursor over the player (PlayerCursor.kt) */
    private var playerCursor: PlayerCursor? = null

    /* Fullscreen video state (onShowCustomView) */
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Streaming app: don't let the screen sleep mid-episode.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        lists = AppLists(this) { installEmbedGuard() }

        webView = WebView(this)
        webView.setBackgroundColor(Color.parseColor("#0a0a0d"))

        // Apps targeting Android 15+ are drawn behind the system bars, and the
        // keyboard no longer shrinks them. Keep the page inside the free area.
        // (Fullscreen video goes straight on the window, so it still fills it.)
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#0a0a0d"))
        root.addView(webView)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            root.setOnApplyWindowInsetsListener { v, insets ->
                val free = insets.getInsets(
                    WindowInsets.Type.systemBars() or
                        WindowInsets.Type.displayCutout() or
                        WindowInsets.Type.ime(),
                )
                v.setPadding(free.left, free.top, free.right, free.bottom)
                WindowInsets.CONSUMED
            }
        }
        setContentView(root)
        if (isTv()) playerCursor = PlayerCursor(this, webView)

        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true                    // saved server choice (localStorage)
        s.mediaPlaybackRequiresUserGesture = false
        s.useWideViewPort = true                      // honor the site's viewport meta
        s.loadWithOverviewMode = true

        // Route window.open / target=_blank through onCreateWindow (denied below)
        // instead of silently navigating the current frame.
        s.setSupportMultipleWindows(true)

        // Present a plain-Chrome User-Agent. The WebView default carries
        // "; wv" and "Version/4.0" tokens, and some embed hosts reject
        // non-browser clients on that basis (same fix as the desktop app,
        // which strips the Electron tokens).
        s.userAgentString = WebSettings.getDefaultUserAgent(this)
            .replace("; wv", "")
            .replace(Regex("""\sVersion/\d+(\.\d+)*"""), "")

        // The stream embeds run in cross-origin iframes; without third-party
        // cookies some hosts refuse to serve the player.
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            // Keep the top frame pinned to the TFLIX site: ad scripts sometimes
            // try to hijack the whole page via top.location = adURL.
            //
            // IMPORTANT: only guard the MAIN frame. The third-party stream
            // <iframe>s legitimately navigate and redirect cross-origin to load
            // their players — blocking those leaves the embeds broken.
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean =
                request.isForMainFrame && !isAllowedSite(request.url)

            // Ad networks get an empty success rather than an error, so an embed
            // checking that its ad script loaded has nothing to object to.
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? =
                if (isAdHost(request.url.host)) {
                    WebResourceResponse(
                        "text/plain", "utf-8", 200, "OK",
                        mapOf("Access-Control-Allow-Origin" to "*"),
                        ByteArrayInputStream(ByteArray(0)),
                    )
                } else {
                    null
                }

            // A new page: the cursor belonged to the old page's player.
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                playerCursor?.exit()
                // TV sticks can leave an app open for days: starting a movie rechecks the lists.
                if (Uri.parse(url).path?.startsWith("/stream") == true) lists.refreshIfDue()
            }

            // Version label (lower-left corner), like the desktop app's.
            override fun onPageFinished(view: WebView, url: String) {
                if (isAllowedSite(Uri.parse(url))) view.evaluateJavascript(versionLabelJs, null)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Block ALL pop-ups / new windows — no popunder ad ever opens.
            // This callback never receives the URL, so a throwaway WebView is
            // attached just to learn it: the Support link (GitHub) goes to the
            // system browser, everything else is dropped without loading.
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message,
            ): Boolean {
                val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
                val probe = WebView(view.context)
                probe.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        v: WebView,
                        request: WebResourceRequest,
                    ): Boolean {
                        val url = request.url.toString()
                        if (url.startsWith(RELEASE_DOWNLOAD_URL)) {
                            downloadRelease(request.url)
                        } else if (url.startsWith(SUPPORT_URL)) {
                            openInBrowser(request.url)
                        }
                        v.destroy()
                        return true  // the probe never loads anything
                    }
                }
                transport.webView = probe
                resultMsg.sendToTarget()
                return true
            }

            // Fullscreen video: the embeds' players call this when the user
            // taps the fullscreen button.
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (customView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                (window.decorView as ViewGroup).addView(
                    view,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                hideSystemBars()
                playerCursor?.onFullscreenChanged(true)
            }

            override fun onHideCustomView() = exitFullscreenVideo()
        }

        installEmbedGuard()
        lists.refresh()

        // TV: lets embed-guard.js say when the cursor is over something clickable.
        // Every frame gets this, but it's one-way and only changes how the cursor looks.
        if (playerCursor != null && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "tflixCursor", setOf("*")) { _, message, _, _, _ ->
                playerCursor?.setOverClickable(message.data == "clickable")
            }
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(SITE_URL)
        }

        // TV: give the WebView focus so the D-pad works immediately.
        webView.requestFocus()
    }

    /* Runs in every frame before the page's own scripts (it leaves the TFLIX site
       alone). WebViews too old for this keep the rest of the ad blocking. Installed
       again when the script libraries change, which applies from the next page. */
    private fun installEmbedGuard() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        if (isDestroyed) return
        embedGuard?.remove()
        embedGuard = WebViewCompat.addDocumentStartJavaScript(
            webView,
            embedGuardJs.replace("__SCRIPT_LIBRARIES__", lists.scriptLibraries),
            setOf("*"),
        )
    }

    private fun openInBrowser(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            // No browser on this device (some TVs) — drop it.
        }
    }

    /* ─── Get Apps downloads ───
       Handed to the system Download Manager: it shows the usual progress
       notification and, once done, tapping it opens the installer (the APK
       is tagged as one), so an update installs over the current app. No
       permission needed: Android 10+ lets the Download Manager write to the
       public Downloads folder; older versions get the app's own Downloads
       folder, which the notification opens just the same.

       On a TV that notification usually can't be opened, so there the app
       opens the installer itself once the APK is in (installWhenDone). That
       is the only use of REQUEST_INSTALL_PACKAGES: the first time, Android
       asks to allow TFLIX to install apps. Phones never trigger it — their
       installs start from the notification, i.e. from the Downloads app. */
    private fun downloadRelease(uri: Uri) {
        val name = uri.lastPathSegment ?: "tflix-download"
        try {
            val request = DownloadManager.Request(uri)
                .setTitle(name)
                .setDescription("TFLIX")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            if (name.endsWith(".apk")) request.setMimeType("application/vnd.android.package-archive")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            } else {
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name)
            }
            val id = (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            val autoInstall = isTv() && name.endsWith(".apk")
            if (autoInstall) installWhenDone(id)
            val msg = if (autoInstall) "Downloading $name… The installer opens when it's done."
                      else "Downloading $name…"
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
        } catch (_: Exception) {
            // Download Manager missing or disabled (some TV builds): try a browser.
            openInBrowser(uri)
        }
    }

    private fun isTv(): Boolean =
        (getSystemService(Context.UI_MODE_SERVICE) as UiModeManager).currentModeType ==
            Configuration.UI_MODE_TYPE_TELEVISION

    private fun installWhenDone(id: Long) {
        pendingInstalls.add(id)
        if (downloadReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val done = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (pendingInstalls.remove(done)) openInstaller(done)
            }
        }
        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        // Sent by the Download Manager (another app), hence exported
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
        downloadReceiver = receiver
    }

    private fun openInstaller(id: Long) {
        val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        var ok = false
        var localUri: String? = null
        dm.query(DownloadManager.Query().setFilterById(id))?.use { c ->
            if (c.moveToFirst()) {
                ok = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) ==
                    DownloadManager.STATUS_SUCCESSFUL
                localUri = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
            }
        }
        if (!ok) {
            Toast.makeText(this, "The download failed. Try again.", Toast.LENGTH_LONG).show()
            return
        }
        // Android 7+ installs from the Download Manager's content:// URI;
        // older versions only take the file:// path
        val apk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) dm.getUriForDownloadedFile(id)
                  else localUri?.let(Uri::parse)
        if (apk == null) return
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apk, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (_: Exception) {
            Toast.makeText(this, "Downloaded to Downloads. Open it with a file manager to install.", Toast.LENGTH_LONG).show()
        }
    }

    private fun exitFullscreenVideo() {
        val view = customView ?: return
        (window.decorView as ViewGroup).removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        showSystemBars()
        playerCursor?.onFullscreenChanged(false)
    }

    /* ─── D-pad Up/Down: drive the site's key-nav, not the WebView scroll ───
       The site (tflix.stream) ships its own arrow-key navigation
       engine that highlights and "selects" posters. In a browser it works
       because keydown + preventDefault cancels the page scroll. On Android TV
       the WebView handles the hardware D-pad Up/Down natively and scrolls the
       page vertically — a scroll the page's JS preventDefault does NOT cancel
       — so focus never moves to the poster row. (Left/Right have no horizontal
       scroll to fight, so they already reach the page and work.)

       Fix: consume the native Up/Down here so the WebView can't scroll, and
       re-dispatch the matching KeyboardEvent into the page so its own engine
       moves the selection and scrolls the focused poster into view itself.

       Note: while the on-screen keyboard (IME) is up, D-pad events go to the
       IME window first and never reach here, so search-field typing is fine. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // TV remote: the cursor over the player, and the remote's media keys
        // (they reach the video without needing the cursor).
        playerCursor?.let { cursor ->
            if (cursor.handleKey(event)) return true
            val command = when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "toggle"
                KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
                KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "forward"
                KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
                else -> null
            }
            if (command != null) {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    // embed-guard.js receives this inside the embed and acts on the video.
                    webView.evaluateJavascript(
                        "(function () { var f = document.getElementById('player');" +
                            " if (f) f.contentWindow.postMessage({ tflixPlayer: '$command', press: ${event.eventTime} }, '*'); })();",
                        null,
                    )
                }
                return true
            }
        }

        val key = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> "ArrowUp"
            KeyEvent.KEYCODE_DPAD_DOWN -> "ArrowDown"
            else -> return super.dispatchKeyEvent(event)
        }
        if (event.action == KeyEvent.ACTION_DOWN && ::webView.isInitialized) {
            val code = if (key == "ArrowUp") 38 else 40
            webView.evaluateJavascript(
                "document.dispatchEvent(new KeyboardEvent('keydown',{" +
                    "key:'$key',code:'$key',keyCode:$code,which:$code," +
                    "bubbles:true,cancelable:true}));",
                null,
            )
        }
        return true  // consume both DOWN and UP so the WebView never scrolls
    }

    /* ─── Back: exit fullscreen video → TV cursor → page history → leave app ─── */
    @Deprecated("Deprecated in API 33; fine for a single-activity shell")
    override fun onBackPressed() {
        when {
            customView != null -> exitFullscreenVideo()
            playerCursor?.active == true -> playerCursor?.exit()
            webView.canGoBack() -> webView.goBack()
            else -> super.onBackPressed()
        }
    }

    /* ─── Immersive mode for fullscreen video ─── */
    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    }

    @Suppress("DEPRECATION")
    private fun showSystemBars() {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
    }

    /* ─── Lifecycle: pause media in background, keep state on rotation ─── */
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        lists.refreshIfDue()
    }

    override fun onDestroy() {
        downloadReceiver?.let { unregisterReceiver(it) }
        webView.destroy()
        super.onDestroy()
    }
}
