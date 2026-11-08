/* ───────────────────────────────────────────────────────────────
   TFLIX Android TV — a remote-driven cursor for the stream players

   The players live in cross-origin iframes, so the site's key navigation
   can highlight one but never reach its buttons, and each server's
   player is different. So on TVs the remote drives a pointer instead,
   and the app sends real touches wherever it points — that works on
   any player, for any button.

     OK on the highlighted player   turn the cursor on
     OK on a server card            pick that server, then turn it on
     Arrows                         move it (hold to go faster)
     OK                             tap
     Back                           leave fullscreen, then turn it off

   While it's off, the remote works as it always did. The cursor brightens
   over anything clickable (embed-guard.js tells it, from inside the embed).
   ─────────────────────────────────────────────────────────────── */

package com.nunesnetwork.tflix

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

@SuppressLint("ViewConstructor")
class PlayerCursor(
    private val activity: Activity,
    private val webView: WebView,
) : View(activity) {

    private companion object {
        const val VIEW_DP = 64          // room for the arrow, its shadow and rings
        const val TIP_INSET_DP = 18     // where the arrow's tip sits inside the view
        const val DROP_RADIUS_DP = 12.5f
        const val DROP_CENTER_DP = 18f  // the teardrop circle's centre, right of and below the tip
        const val STEP_DP = 14          // one press
        const val STEP_GROWTH_DP = 4    // added per repeat while a key is held
        const val MAX_HOLD_REPEATS = 16
        const val HIDE_AFTER_MS = 3000L
        const val TAP_MS = 50L
        const val HINT_MS = 5000L
        const val AFTER_SERVER_PICK_MS = 250L
        const val CLICKABLE_SCALE = 0.12f
        const val PLAIN_RED = 0xFF8E0B13.toInt()
        const val CLICKABLE_RED = 0xFFFF3B47.toInt()

        // What the site's key navigation has highlighted, if anything
        const val HIGHLIGHTED_PLAYER = ".player-wrap.kf"
        const val HIGHLIGHTED_SERVER = ".server-card.kf"
        const val PLAYER = "#player-wrap"
    }

    private val density = resources.displayMetrics.density
    private val tipInset = TIP_INSET_DP * density

    private val cursorBounds = RectF()   // where the cursor may go, in window pixels
    private var cursorX = 0f
    private var cursorY = 0f
    private var fullscreen = false

    var active = false
        private set

    /* ─── Drawing: a teardrop with its tip at the pointing spot ───
       A circle down-right of the tip, joined to the tip by the two straight
       lines that touch the circle. Dark red, light vivid red over anything clickable. */
    private val drop = Path().apply {
        val radius = DROP_RADIUS_DP * density
        val center = DROP_CENTER_DP * density
        val towardsTip = 225f   // degrees, from the circle's centre to the tip
        val tangent = Math.toDegrees(acos(radius / (center * sqrt(2f))).toDouble()).toFloat()
        val startAngle = towardsTip + tangent
        val startRadians = Math.toRadians(startAngle.toDouble())
        moveTo(0f, 0f)
        lineTo(center + radius * cos(startRadians).toFloat(), center + radius * sin(startRadians).toFloat())
        arcTo(RectF(center - radius, center - radius, center + radius, center + radius), startAngle, 360 - 2 * tangent)
        close()
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL_AND_STROKE
        strokeWidth = 1.5f * density       // with the round join, softens the tip
        strokeJoin = Paint.Join.ROUND
        setShadowLayer(7 * density, 0f, 2.5f * density, 0x99000000.toInt())
    }
    private val edgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.2f * density
        strokeJoin = Paint.Join.ROUND
        color = 0x55FFFFFF                 // keeps the dark red visible on dark scenes
    }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val colors = ArgbEvaluator()

    private var clickableAmount = 0f   // 0 = plain, 1 = over something clickable
    private var clickableAnimator: ValueAnimator? = null
    private var pressAmount = 0f       // 0 = nothing, then runs 1 → 0 after a tap
    private var pressAnimator: ValueAnimator? = null

    override fun onDraw(canvas: Canvas) {
        // The ring a tap leaves behind
        if (pressAmount > 0f) {
            ringPaint.style = Paint.Style.STROKE
            ringPaint.strokeWidth = 2 * density
            ringPaint.color = Color.argb((pressAmount * 200).toInt(), 255, 255, 255)
            canvas.drawCircle(tipInset, tipInset, (1 - pressAmount) * 15 * density + 3 * density, ringPaint)
        }
        val scale = 1 + clickableAmount * CLICKABLE_SCALE
        fillPaint.color = colors.evaluate(clickableAmount, PLAIN_RED, CLICKABLE_RED) as Int
        canvas.save()
        canvas.translate(tipInset, tipInset)
        canvas.scale(scale, scale)
        canvas.drawPath(drop, fillPaint)
        canvas.drawPath(drop, edgePaint)
        canvas.restore()
    }

    /* Called from embed-guard.js as the cursor crosses a player's controls. */
    fun setOverClickable(clickable: Boolean) {
        val target = if (clickable && active) 1f else 0f
        if (target == clickableAmount) return
        clickableAnimator?.cancel()
        clickableAnimator = ValueAnimator.ofFloat(clickableAmount, target).apply {
            duration = 140
            addUpdateListener {
                clickableAmount = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    private fun showPress() {
        pressAnimator?.cancel()
        pressAnimator = ValueAnimator.ofFloat(1f, 0f).apply {
            duration = 280
            addUpdateListener {
                pressAmount = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    /* ─── The hint shown when the cursor turns on ─── */
    private val hint = TextView(activity).apply {
        text = "Arrows move the cursor  ·  OK clicks  ·  Back leaves"
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        val horizontal = (22 * density).toInt()
        val vertical = (11 * density).toInt()
        setPadding(horizontal, vertical, horizontal, vertical)
        background = GradientDrawable().apply {
            cornerRadius = 26 * density
            setColor(0xEB15151B.toInt())
            setStroke((1 * density).toInt(), 0x33FFFFFF)
        }
        visibility = GONE
    }
    private val hideHint = Runnable {
        hint.animate().alpha(0f).setDuration(300).withEndAction { hint.visibility = GONE }
    }

    private val hide = Runnable { animate().alpha(0f).setDuration(400) }

    init {
        // A shadow on a path needs software drawing; the view is small and rarely redraws.
        setLayerType(LAYER_TYPE_SOFTWARE, null)
        // Never takes input itself: touches and hovers pass straight to what's under it.
        isClickable = false
        isFocusable = false
        visibility = GONE
        val size = (VIEW_DP * density).toInt()
        val root = activity.window.decorView as ViewGroup
        root.addView(this, ViewGroup.LayoutParams(size, size))
        root.addView(
            hint,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
            ).apply { bottomMargin = (96 * density).toInt() },  // above the players' control bars
        )
    }

    /* ─── Remote keys. Returns true when the key was used up here. ─── */
    fun handleKey(event: KeyEvent): Boolean {
        val isOk = event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            event.keyCode == KeyEvent.KEYCODE_ENTER ||
            event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER

        if (!active) {
            // The key still reaches the site: it picks a server card, and does nothing on the player.
            if (isOk && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) onOkOnSite()
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
    private fun onOkOnSite() {
        val js = "document.querySelector('$HIGHLIGHTED_SERVER') ? 'server' : " +
            "document.querySelector('$HIGHLIGHTED_PLAYER') ? 'player' : ''"
        webView.evaluateJavascript(js) { result ->
            when (result) {
                "\"player\"" -> enter()
                // Let the site load the server first, then move its highlight to the player.
                "\"server\"" -> postDelayed({
                    webView.evaluateJavascript(
                        "window.__knavFocus && window.__knavFocus(document.querySelector('$PLAYER'))",
                    ) { enter() }
                }, AFTER_SERVER_PICK_MS)
            }
        }
    }

    private fun enter() {
        readPlayerBounds(HIGHLIGHTED_PLAYER) { found ->
            if (!found || active) return@readPlayerBounds
            active = true
            visibility = VISIBLE
            bringOnTop()
            moveTo(cursorBounds.centerX(), cursorBounds.centerY())
            showHint()
        }
    }

    fun exit() {
        if (!active) return
        active = false
        removeCallbacks(hide)
        animate().cancel()
        visibility = GONE
        setOverClickable(false)
        hideHintNow()
        sendHover(MotionEvent.ACTION_HOVER_EXIT)
        // Taps moved the focus into the iframe; hand the keys back to the site.
        webView.evaluateJavascript("if (document.activeElement) document.activeElement.blur(); window.focus();", null)
    }

    private fun showHint() {
        hint.removeCallbacks(hideHint)
        hint.animate().cancel()
        hint.alpha = 1f
        hint.visibility = VISIBLE
        hint.postDelayed(hideHint, HINT_MS)
    }

    private fun hideHintNow() {
        hint.removeCallbacks(hideHint)
        hint.animate().cancel()
        hint.visibility = GONE
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
        (parent as? ViewGroup)?.run {
            bringChildToFront(hint)
            bringChildToFront(this@PlayerCursor)
        }
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
        translationX = cursorX - tipInset
        translationY = cursorY - tipInset
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
        showPress()
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
