/* ───────────────────────────────────────────────────────────────
   TFLIX Android — the ad-blocking lists, kept up to date from the site

   assets/app-lists.json on the site holds the ad hosts to block and the
   script libraries the stream embeds may load. Keeping them there means
   a list can change without an app update, like the rest of the site.

   The app always starts from what it already has (its saved copy, or the
   one inside the APK), so nothing waits for the network, and checks for a
   new version in the background. A download that fails or doesn't look
   right is ignored whole, so a typo in the file can't break the app.
   ─────────────────────────────────────────────────────────────── */

package com.nunesnetwork.tflix

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class AppLists(
    private val context: Context,
    private val onScriptLibrariesChanged: () -> Unit,
) {
    private companion object {
        const val LISTS_URL = "https://tflix.stream/assets/app-lists.json"
        const val FILE_NAME = "app-lists.json"
        const val PREFS = "app_lists"
        const val PREF_ETAG = "etag"
        const val PREF_LAST_CHECK = "last_check"
        const val RECHECK_AFTER_MS = 6 * 60 * 60 * 1000L
        const val TIMEOUT_MS = 8000
        const val MAX_BYTES = 256 * 1024

        val AD_HOST = Regex("""^[a-z0-9-]+(\.[a-z0-9-]+)+$""")
        // Goes into a security rule, so nothing but a plain https address gets through.
        val LIBRARY = Regex("""^https://(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$""")
    }

    private class Lists(val adHosts: Set<String>, val scriptLibraries: String)

    private val savedFile = File(context.filesDir, FILE_NAME)
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val checking = AtomicBoolean(false)

    @Volatile
    private var current: Lists = loadSaved() ?: loadBundled()

    /* Read for every request, on WebView's own threads. */
    val adHosts: Set<String> get() = current.adHosts

    /* Space-separated, as the embeds' security rule wants them. */
    val scriptLibraries: String get() = current.scriptLibraries

    /* ─── Checking for a new version ─── */
    fun refreshIfDue() {
        if (System.currentTimeMillis() - prefs.getLong(PREF_LAST_CHECK, 0) >= RECHECK_AFTER_MS) refresh()
    }

    fun refresh() {
        if (!checking.compareAndSet(false, true)) return
        thread(name = "app-lists") {
            try {
                download()
            } catch (_: Exception) {
                // No network, or the site's having a moment: keep what we have, try again later.
            } finally {
                checking.set(false)
            }
        }
    }

    private fun download() {
        val connection = URL(LISTS_URL).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.useCaches = false
            if (savedFile.exists()) {
                prefs.getString(PREF_ETAG, null)?.let { connection.setRequestProperty("If-None-Match", it) }
            }
            when (connection.responseCode) {
                HttpURLConnection.HTTP_NOT_MODIFIED -> markChecked(null)
                HttpURLConnection.HTTP_OK -> {
                    val text = connection.inputStream.use(::readLimited) ?: return
                    val lists = parse(text) ?: return
                    save(text)
                    markChecked(connection.getHeaderField("ETag"))
                    val librariesChanged = lists.scriptLibraries != current.scriptLibraries
                    current = lists
                    if (librariesChanged) Handler(Looper.getMainLooper()).post(onScriptLibrariesChanged)
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readLimited(input: InputStream): String? {
        val bytes = input.readBytes()
        return if (bytes.size <= MAX_BYTES) String(bytes, Charsets.UTF_8) else null
    }

    private fun markChecked(etag: String?) {
        prefs.edit().apply {
            putLong(PREF_LAST_CHECK, System.currentTimeMillis())
            if (etag != null) putString(PREF_ETAG, etag)
        }.apply()
    }

    /* ─── Reading the file ─── */
    private fun loadSaved(): Lists? = try {
        if (savedFile.exists()) parse(savedFile.readText()) else null
    } catch (_: Exception) {
        null
    }

    private fun loadBundled(): Lists =
        parse(context.assets.open(FILE_NAME).bufferedReader().use { it.readText() })
            ?: error("The app-lists.json inside the APK is invalid")

    /* The whole file or nothing: one bad entry means something went wrong with it. */
    private fun parse(text: String): Lists? = try {
        val json = JSONObject(text)
        val hosts = json.getJSONArray("adHosts").strings()
        val libraries = json.getJSONArray("scriptLibraries").strings()
        if (hosts.isEmpty() || libraries.isEmpty() ||
            !hosts.all(AD_HOST::matches) || !libraries.all(LIBRARY::matches)
        ) {
            null
        } else {
            Lists(hosts.toSet(), libraries.joinToString(" "))
        }
    } catch (_: Exception) {
        null
    }

    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }

    /* Written beside the real file first, so a crash can't leave half a list. */
    private fun save(text: String) {
        val temp = File(context.filesDir, "$FILE_NAME.tmp")
        temp.writeText(text)
        if (!temp.renameTo(savedFile)) temp.delete()
    }
}
