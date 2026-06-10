/* ───────────────────────────────────────────────────────────────
   TFLIX Android — phone + Android TV

   A thin native shell around the live TFLIX website
   (https://tflix.nunesnetwork.com), the Android counterpart of the
   Electron desktop app. The WebView loads the deployed site directly,
   so any change to the site — new stream servers, fixed embeds —
   appears instantly, with no app update.

   The app's only job is ad-blocking:
     • every window.open / target=_blank is denied (onCreateWindow),
       so the popunder ads the stream embeds fire never open
     • the top frame is pinned to the TFLIX origin; the stream
       <iframe>s still navigate/redirect freely — blocking those
       breaks the embeds (same lesson as the desktop app)
   ─────────────────────────────────────────────────────────────── */

package com.nunesnetwork.tflix

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    companion object {
        private const val SITE_URL = "https://tflix.nunesnetwork.com/"
        private const val SITE_ORIGIN = "https://tflix.nunesnetwork.com"
    }

    private lateinit var webView: WebView

    /* Fullscreen video state (onShowCustomView) */
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Streaming app: don't let the screen sleep mid-episode.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        webView.setBackgroundColor(Color.parseColor("#0a0a0d"))
        setContentView(webView)

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
                request.isForMainFrame && !request.url.toString().startsWith(SITE_ORIGIN)
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Block ALL pop-ups / new windows — no popunder ad ever opens.
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message,
            ): Boolean = false

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
            }

            override fun onHideCustomView() = exitFullscreenVideo()
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(SITE_URL)
        }

        // TV: give the WebView focus so the D-pad works immediately.
        webView.requestFocus()
    }

    private fun exitFullscreenVideo() {
        val view = customView ?: return
        (window.decorView as ViewGroup).removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        showSystemBars()
    }

    /* ─── Back: exit fullscreen video → page history → leave app ─── */
    @Deprecated("Deprecated in API 33; fine for a single-activity shell")
    override fun onBackPressed() {
        when {
            customView != null -> exitFullscreenVideo()
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
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
