/* ───────────────────────────────────────────────────────────────
   TFLIX Android TV — a remote-driven cursor for the stream players

   The players live in cross-origin iframes, so the site's key navigation
   can highlight one but never reach its buttons, and each server's
   player is different. So on TVs the remote drives a pointer instead,
   and the app sends real touches wherever it points — that works on
   any player, for any button.

     OK on the highlighted player   turn the cursor on
     Arrows                         move it (hold to go faster)
     OK                             tap
     Back                           leave fullscreen, then turn it off

   While it's off, the remote works as it always did.
   ─────────────────────────────────────────────────────────────── */

package com.nunesnetwork.tflix

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Toast
import kotlin.math.min

@SuppressLint("ViewConstructor")
class PlayerCursor(
    private val activity: Activity,
    private val webView: WebView,
) : View(activity) {

    private companion object {
        const val SIZE_DP = 40
        const val STEP_DP = 14          // one press
        const val STEP_GROWTH_DP = 4    // added per repeat while a key is held
        const val MAX_HOLD_REPEATS = 16
        const val HIDE_AFTER_MS = 3000L
        const val TAP_MS = 50L

        // The player the site's key navigation has highlighted, if any
        const val HIGHLIGHTED = ".player-wrap.kf"
        const val PLAYER = "#player-wrap"
    }

    private val density = resources.displayMetrics.density
    private val sizePx = (SIZE_DP * density).toInt()

    private val cursorBounds = RectF()   // where the cursor may go, in window pixels
    private var cursorX = 0f
    private var cursorY = 0f
    private var fullscreen = false

    var active = false
        private set

    /* ─── Drawing: a white arrow with a dark edge, its tip at the view's corner ─── */
    private val arrow = Path().apply {
        val s = SIZE_DP * density / 30f
        moveTo(1 * s, 1 * s)
        lineTo(1 * s, 23 * s)
        lineTo(7 * s, 18 * s)
        lineTo(11 * s, 27 * s)
        lineTo(15 * s, 25 * s)
        lineTo(11 * s, 17 * s)
        lineTo(19 * s, 17 * s)
        close()
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val edgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        style = Paint.Style.STROKE
        strokeWidth = 2 * density
        strokeJoin = Paint.Join.ROUND
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawPath(arrow, edgePaint)
        canvas.drawPath(arrow, fillPaint)
    }

    private val hide = Runnable { animate().alpha(0f).setDuration(400) }

    init {
        // Never takes input itself: touches and hovers pass straight to what's under it.
        isClickable = false
        isFocusable = false
        visibility = GONE
        (activity.window.decorView as ViewGroup).addView(this, ViewGroup.LayoutParams(sizePx, sizePx))
    }

    /* ─── Remote keys. Returns true when the key was used up here. ─── */
    fun handleKey(event: KeyEvent): Boolean {
        val isOk = event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            event.keyCode == KeyEvent.KEYCODE_ENTER ||
            event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER

        if (!active) {
            // The key still reaches the site, where OK on the player does nothing.
            if (isOk && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) enterIfHighlighted()
            return false
        }

        val dx: Int
        val dy: Int
        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> { dx = -1; dy = 0 }
            KeyEvent.KEYCODE_DPAD_RIGHT -> { dx = 1; dy = 0 }
            KeyEvent.KEYCODE_DPAD_UP -> { dx = 0; dy = -1 }
            KeyEvent.KEYCODE_DPAD_DOWN -> { dx = 0; dy = 1 }
            else -> {
                if (!isOk) return false
                if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) tap()
                return true
            }
        }
        if (event.action == KeyEvent.ACTION_DOWN) {
            val step = (STEP_DP + min(event.repeatCount, MAX_HOLD_REPEATS) * STEP_GROWTH_DP) * density
            moveTo(cursorX + dx * step, cursorY + dy * step)
        }
        return true
    }

    /* ─── Turning it on and off ─── */
    private fun enterIfHighlighted() {
        readPlayerBounds(HIGHLIGHTED) { found ->
            if (!found || active) return@readPlayerBounds
            active = true
            visibility = VISIBLE
            bringOnTop()
            moveTo(cursorBounds.centerX(), cursorBounds.centerY())
            Toast.makeText(activity, "Arrows move the cursor, OK clicks, Back leaves", Toast.LENGTH_SHORT).show()
        }
    }

    fun exit() {
        if (!active) return
        active = false
        removeCallbacks(hide)
        animate().cancel()
        visibility = GONE
        sendHover(MotionEvent.ACTION_HOVER_EXIT)
        // Taps moved the focus into the iframe; hand the keys back to the site.
        webView.evaluateJavascript("if (document.activeElement) document.activeElement.blur(); window.focus();", null)
    }

    /* The player's fullscreen goes straight on the window, above this view. */
    fun onFullscreenChanged(isFullscreen: Boolean) {
        fullscreen = isFullscreen
        if (!active) return
        bringOnTop()
        if (isFullscreen) {
            val root = activity.window.decorView
            cursorBounds.set(0f, 0f, root.width.toFloat(), root.height.toFloat())
            moveTo(cursorX, cursorY)
        } else {
            readPlayerBounds(PLAYER) { moveTo(cursorX, cursorY) }
        }
    }

    private fun bringOnTop() {
        (parent as? ViewGroup)?.bringChildToFront(this)
    }

    /* Asks the page where the player is, in window pixels. */
    private fun readPlayerBounds(selector: String, done: (Boolean) -> Unit) {
        val js = """
            (function () {
              var el = document.querySelector('$selector');
              if (!el) return '';
              el.scrollIntoView({ block: 'center', behavior: 'instant' });
              var r = el.getBoundingClientRect();
              return [r.left, r.top, r.right, r.bottom, window.devicePixelRatio].join(',');
            })()
        """.trimIndent()
        webView.evaluateJavascript(js) { result ->
            val parts = result?.trim('"')?.split(',')?.mapNotNull { it.toFloatOrNull() }
            if (parts == null || parts.size != 5) {
                done(false)
                return@evaluateJavascript
            }
            val inWindow = IntArray(2).also { webView.getLocationInWindow(it) }
            val scale = parts[4]
            cursorBounds.set(
                inWindow[0] + parts[0] * scale,
                inWindow[1] + parts[1] * scale,
                inWindow[0] + parts[2] * scale,
                inWindow[1] + parts[3] * scale,
            )
            done(true)
        }
    }

    /* ─── Moving and tapping ─── */
    private fun moveTo(x: Float, y: Float) {
        // Keep the tip a little inside, so it can still reach the player's edge buttons.
        cursorX = x.coerceIn(cursorBounds.left, cursorBounds.right - 1)
        cursorY = y.coerceIn(cursorBounds.top, cursorBounds.bottom - 1)
        translationX = cursorX
        translationY = cursorY
        wake()
        // Players show their controls when a mouse moves over them.
        sendHover(MotionEvent.ACTION_HOVER_MOVE)
    }

    private fun wake() {
        removeCallbacks(hide)
        animate().cancel()
        alpha = 1f
        postDelayed(hide, HIDE_AFTER_MS)
    }

    private fun tap() {
        wake()
        val downTime = SystemClock.uptimeMillis()
        sendTouch(downTime, downTime, MotionEvent.ACTION_DOWN)
        postDelayed({ sendTouch(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP) }, TAP_MS)
    }

    private fun sendTouch(downTime: Long, eventTime: Long, action: Int) {
        val event = MotionEvent.obtain(downTime, eventTime, action, cursorX, cursorY, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        activity.dispatchTouchEvent(event)
        event.recycle()
    }

    private fun sendHover(action: Int) {
        val properties = MotionEvent.PointerProperties().apply {
            id = 0
            toolType = MotionEvent.TOOL_TYPE_MOUSE
        }
        val coords = MotionEvent.PointerCoords().apply {
            x = cursorX
            y = cursorY
            pressure = 0f
            size = 1f
        }
        val now = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            now, now, action, 1, arrayOf(properties), arrayOf(coords),
            0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0,
        )
        activity.dispatchGenericMotionEvent(event)
        event.recycle()
    }
}
