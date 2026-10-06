package expo.modules.calls

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * The first thing a tap on a call's notification opens: no window, no
 * layout, gone in the same frame.
 *
 * It exists because the tap's meaning — which call, and whether it was
 * Answer — cannot be trusted to reach the app's own activity in the intent
 * that opened it. The development client's launcher swaps that intent for its
 * own on a cold start, and a future one could as well. So the meaning is
 * written to `CallState` here, in the same process, where JavaScript reads it
 * (`CallsModule.takePendingAction`), and only then is the app opened.
 *
 * An activity rather than a receiver: Android 12 and later refuse to let a
 * receiver started by a notification tap open an activity of its own.
 */
class CallOpenActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    val callId = intent.getStringExtra(CallService.EXTRA_CALL_ID)
    if (callId != null) {
      val answer = intent.getBooleanExtra(CallService.EXTRA_ANSWER, false)
      CallState.pending = CallState.PendingAction(callId, answer)
      // Answering stops the ring here; JavaScript takes the call from there.
      if (answer) CallService.stopRing(this, callId)
      CallState.emit(CallActivityListener.EVENT_PENDING, callId)
    }
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    }
    finish()
  }
}
