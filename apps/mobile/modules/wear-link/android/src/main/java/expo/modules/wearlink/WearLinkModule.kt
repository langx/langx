package expo.modules.wearlink

import android.content.Context
import androidx.core.content.edit
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app's half of the Wear OS contract.
 *
 * Deliberately dumb, the same way `CompanionSnapshotModule` and
 * `WatchLinkModule` are: it takes a JSON string `buildWatchPayload` already
 * produced and hands it over as-is. The shape is defined once, in
 * `packages/shared/src/watch.ts`, and a second definition in Kotlin would be
 * free to drift from it. What this file knows is *where* the blob goes.
 *
 * **`DataClient`, not `MessageClient`.** A data item is a single value the
 * system replaces and redelivers when the watch next comes up — the same thing
 * `updateApplicationContext` gives us on Apple — so a watch that was off while
 * three messages arrived wakes holding the current state instead of replaying
 * stale ones. There is only ever one latest answer, so nothing here queues.
 *
 * `setUrgent` because the whole point of the payload is that it is current: a
 * data item left to the system's own schedule can sit for minutes, which on a
 * wrist is the difference between "here is your message" and "here is a
 * message from earlier".
 */
class WearLinkModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("WearLink")

    /**
     * Whether there is anything to talk to.
     *
     * True wherever Play services are present, which is not the same as a
     * watch being paired — nothing on the phone gets to know that reliably,
     * and the watch itself draws the honest answer when the phone goes quiet.
     * The caller uses this to skip *building* a payload on a device that has
     * no Wear support at all.
     */
    Function("isSupported") {
      com.google.android.gms.common.GoogleApiAvailability.getInstance()
          .isGooglePlayServicesAvailable(context) == com.google.android.gms.common.ConnectionResult.SUCCESS
    }

    Function("send") { json: String ->
      val request = PutDataMapRequest.create(PATH_PAYLOAD)
      request.dataMap.putString("payload", json)
      /*
       A timestamp the value does not otherwise carry. A data item whose bytes
       are identical to the last one is *not redelivered*, so two payloads that
       happen to be equal — a message read and then another arriving, leaving
       the same counts — would leave the watch silent. This makes every write
       distinct without the watch having to read it.
      */
      request.dataMap.putLong("writtenAt", System.currentTimeMillis())
      Wearable.getDataClient(context).putDataItem(request.asPutDataRequest().setUrgent())
    }

    /**
     * Sign-out, in one call because the two halves must not come apart: an
     * emptied watch that can still send, or a watch still listing the previous
     * account's threads, are each a bug with a face.
     */
    Function("clear") {
      WearCredentials.clear(context)
      val request = PutDataMapRequest.create(PATH_PAYLOAD)
      request.dataMap.putString("payload", "")
      request.dataMap.putLong("writtenAt", System.currentTimeMillis())
      Wearable.getDataClient(context).putDataItem(request.asPutDataRequest().setUrgent())
    }

    /**
     * Give Kotlin what it needs to send a reply while the app is not running.
     *
     * Called on sign-in and whenever the cookie is refreshed. The alternative
     * — asking JavaScript for it when a reply arrives — cannot work: a
     * `WearableListenerService` is started into a process with no React
     * runtime, and waiting for one to reach the point where it could answer is
     * how the reply times out on somebody's wrist.
     */
    Function("setCredentials") { baseUrl: String, cookie: String ->
      WearCredentials.save(context, baseUrl, cookie)
    }
  }

  companion object {
    /** Must match the paths in `wear/PhoneLink.kt`. */
    const val PATH_PAYLOAD = "/langx/payload"
  }
}

/**
 * Where the phone keeps what it needs to send a reply without JavaScript.
 *
 * `EncryptedSharedPreferences` would be the closer twin of the Keychain the
 * Apple side uses. It is deliberately not used here: it pulls in Jetpack
 * Security, which is in maintenance and whose master-key handling has its own
 * failure modes on older devices — and the file below is inside the app's
 * private storage, which is the same protection the session cookie already has
 * in `expo-secure-store`'s Android implementation. Worth revisiting if the app
 * ever stores more than one credential this way.
 */
internal object WearCredentials {
  private const val FILE = "langx_wear"

  data class Stored(val baseUrl: String, val cookie: String)

  fun save(context: Context, baseUrl: String, cookie: String) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit {
      putString("baseUrl", baseUrl)
      putString("cookie", cookie)
    }
  }

  fun load(context: Context): Stored? {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val baseUrl = prefs.getString("baseUrl", null) ?: return null
    val cookie = prefs.getString("cookie", null) ?: return null
    return Stored(baseUrl, cookie)
  }

  /**
   * Sign-out, and the reason this is a function rather than an overwrite: a
   * stale cookie would let a watch still showing the previous account's threads
   * send a message *as* them, from a phone that may have been handed on.
   */
  fun clear(context: Context) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit { clear() }
  }
}
