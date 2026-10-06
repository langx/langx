package expo.modules.calls

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Found by Expo's autolinking by its name; see `CallActivityListener`. */
class CallsPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
      listOf(CallActivityListener())
}

/**
 * Lets the app's activity show over the lock screen, and wake it, while a
 * call is ringing or up — which a messaging app must not do the rest of the
 * time, so it is switched back off as soon as there is no call. The tap that
 * opened the app is recorded before it gets here, by `CallOpenActivity`.
 */
class CallActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    showOverLockScreen(activity)
  }

  override fun onResume(activity: Activity) {
    CallState.inForeground = true
    showOverLockScreen(activity)
  }

  override fun onPause(activity: Activity) {
    CallState.inForeground = false
  }

  private fun showOverLockScreen(activity: Activity) {
    val inCall = CallState.pending != null || CallState.ringingCallId != null || CallState.ongoing
    if (Build.VERSION.SDK_INT >= 27) {
      activity.setShowWhenLocked(inCall)
      activity.setTurnScreenOn(inCall)
    }
  }

  companion object {
    const val EVENT_PENDING = "pending"
  }
}
