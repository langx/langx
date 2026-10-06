package expo.modules.calls

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What JavaScript can ask of the call's native half on Android.
 *
 * Small on purpose: the media is WebRTC's, the call's state is the server's
 * and the session's, and this only draws what Android insists on drawing
 * itself — the ring, the call in progress — and says what was tapped.
 */
class CallsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("Calls")

    /** `{ type: 'pending' | 'declined' | 'hangUp', callId?: string }` */
    Events("onCallAction")

    OnCreate {
      CallState.listener = { type, callId ->
        sendEvent("onCallAction", mapOf("type" to type, "callId" to callId))
      }
    }
    OnDestroy { CallState.listener = null }

    /** Where Decline sends its request when no JavaScript is running. */
    Function("configure") { baseUrl: String -> CallPrefs.setBaseUrl(context, baseUrl) }

    /** The call a notification opened the app for, once, or `null`. */
    Function("takePendingAction") {
      val pending = CallState.pending ?: return@Function null
      CallState.pending = null
      mapOf("callId" to pending.callId, "answer" to pending.answer)
    }

    Function("stopRinging") { callId: String? -> CallService.stopRing(context, callId) }

    Function("startOngoing") { name: String, video: Boolean ->
      CallService.startOngoing(context, name, video)
      CallAudio.begin(context, speaker = video)
    }

    Function("stopOngoing") {
      CallService.stop(context)
      CallAudio.end(context)
    }

    Function("setSpeakerphone") { on: Boolean -> CallAudio.setSpeaker(context, on) }
  }
}
