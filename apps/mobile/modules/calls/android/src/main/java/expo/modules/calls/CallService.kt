package expo.modules.calls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * The foreground service a call holds, in its two shapes.
 *
 * **Ringing**, while the app is closed: the system's call notification, with
 * Answer and Decline, which takes over a locked screen where the full-screen
 * permission allows and is a heads-up notification where it does not. Its
 * sound is the phone's own ringtone, through a channel of its own, so the
 * person's ringer settings and Do Not Disturb apply to it like any call.
 *
 * **Ongoing**, once answered: the "call in progress" notification with Hang
 * up, and what keeps the microphone — and for video the camera — running
 * while the screen is off or another app is in front. Android stops a
 * backgrounded app's microphone otherwise, which is a call that goes silent.
 *
 * A service rather than a plain notification because Android 12 and later
 * only allow a call-style notification from one, and a ring that starts from
 * a data push is the one case where a background start is allowed.
 */
class CallService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var ringTimeout: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> ring(intent)
      ACTION_STOP_RING -> stopRinging(intent.getStringExtra(EXTRA_CALL_ID))
      ACTION_ONGOING -> ongoing(intent)
      ACTION_STOP -> stopEverything()
    }
    return START_NOT_STICKY
  }

  private fun ring(intent: Intent) {
    val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return stopEverything()
    val video = intent.getBooleanExtra(EXTRA_VIDEO, false)
    val name = intent.getStringExtra(EXTRA_NAME).orEmpty()
    val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
    val seconds = intent.getIntExtra(EXTRA_SECONDS, 45)
    ensureChannels(this)
    CallState.ringingCallId = callId

    val caller = Person.Builder().setName(name).setImportant(true).build()
    val notification =
        NotificationCompat.Builder(this, CHANNEL_RING)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(name)
            .setContentText(getString(if (video) R.string.calls_incomingVideo else R.string.calls_incomingVoice))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(seconds * 1000L)
            .setContentIntent(openApp(this, callId, answer = false, REQUEST_OPEN))
            .setFullScreenIntent(openApp(this, callId, answer = false, REQUEST_FULL_SCREEN), true)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    caller,
                    CallActionReceiver.decline(this, callId, token),
                    openApp(this, callId, answer = true, REQUEST_ANSWER),
                ),
            )
            .build()
    start(notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)

    // The server ends an unanswered ring and says so; this is for when that
    // word never arrives — a phone that lost its network while it rang.
    ringTimeout?.let(handler::removeCallbacks)
    ringTimeout = Runnable { stopRinging(callId) }.also { handler.postDelayed(it, seconds * 1000L + 5000L) }
  }

  private fun stopRinging(callId: String?) {
    if (callId != null && CallState.ringingCallId != null && callId != CallState.ringingCallId) return
    CallState.ringingCallId = null
    ringTimeout?.let(handler::removeCallbacks)
    ringTimeout = null
    if (!CallState.ongoing) stopEverything()
  }

  private fun ongoing(intent: Intent) {
    val name = intent.getStringExtra(EXTRA_NAME).orEmpty()
    val video = intent.getBooleanExtra(EXTRA_VIDEO, false)
    ensureChannels(this)
    CallState.ringingCallId = null
    ringTimeout?.let(handler::removeCallbacks)
    CallState.ongoing = true

    val caller = Person.Builder().setName(name).setImportant(true).build()
    val notification =
        NotificationCompat.Builder(this, CHANNEL_ONGOING)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(name)
            .setContentText(getString(if (video) R.string.calls_videoCall else R.string.calls_voiceCall))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setUsesChronometer(true)
            .setWhen(System.currentTimeMillis())
            .setContentIntent(openApp(this, null, answer = false, REQUEST_OPEN))
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(caller, CallActionReceiver.hangUp(this)))
            .build()
    var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    if (video) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    start(notification, type)
  }

  private fun start(notification: Notification, type: Int) {
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, if (Build.VERSION.SDK_INT >= 29) type else 0)
    } catch (error: Exception) {
      // Refused — a background start the system did not allow. The call is
      // still on the server and in the thread; there is nothing to show it on.
      stopEverything()
    }
  }

  private fun stopEverything() {
    ringTimeout?.let(handler::removeCallbacks)
    ringTimeout = null
    CallState.ringingCallId = null
    CallState.ongoing = false
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  companion object {
    const val ACTION_RING = "expo.modules.calls.RING"
    const val ACTION_STOP_RING = "expo.modules.calls.STOP_RING"
    const val ACTION_ONGOING = "expo.modules.calls.ONGOING"
    const val ACTION_STOP = "expo.modules.calls.STOP"
    const val EXTRA_CALL_ID = "langx.call.id"
    const val EXTRA_ANSWER = "langx.call.answer"
    private const val EXTRA_VIDEO = "langx.call.video"
    private const val EXTRA_NAME = "langx.call.name"
    private const val EXTRA_TOKEN = "langx.call.token"
    private const val EXTRA_SECONDS = "langx.call.seconds"
    private const val CHANNEL_RING = "langx_calls_ring"
    private const val CHANNEL_ONGOING = "langx_calls_ongoing"
    private const val NOTIFICATION_ID = 7_316
    private const val REQUEST_OPEN = 7_316_1
    private const val REQUEST_FULL_SCREEN = 7_316_2
    private const val REQUEST_ANSWER = 7_316_3

    fun startRing(context: Context, ring: RingData) {
      val intent =
          Intent(context, CallService::class.java)
              .setAction(ACTION_RING)
              .putExtra(EXTRA_CALL_ID, ring.callId)
              .putExtra(EXTRA_VIDEO, ring.video)
              .putExtra(EXTRA_NAME, ring.callerName)
              .putExtra(EXTRA_TOKEN, ring.callToken)
              .putExtra(EXTRA_SECONDS, ring.ringSeconds)
      ContextCompat.startForegroundService(context, intent)
    }

    /** Stops the ring for this call — or any ring, with `null` — and leaves a call in progress alone. */
    fun stopRing(context: Context, callId: String?) {
      if (CallState.ringingCallId == null) return
      context.startService(
          Intent(context, CallService::class.java).setAction(ACTION_STOP_RING).putExtra(EXTRA_CALL_ID, callId),
      )
    }

    fun startOngoing(context: Context, name: String, video: Boolean) {
      val intent =
          Intent(context, CallService::class.java)
              .setAction(ACTION_ONGOING)
              .putExtra(EXTRA_NAME, name)
              .putExtra(EXTRA_VIDEO, video)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      if (CallState.ringingCallId == null && !CallState.ongoing) return
      context.startService(Intent(context, CallService::class.java).setAction(ACTION_STOP))
    }

    /** Opens the app by way of `CallOpenActivity`, which records which call and why. */
    fun openApp(context: Context, callId: String?, answer: Boolean, request: Int): PendingIntent {
      val launch =
          Intent(context, CallOpenActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (callId != null) launch.putExtra(EXTRA_CALL_ID, callId).putExtra(EXTRA_ANSWER, answer)
      return PendingIntent.getActivity(
          context,
          request,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    fun ensureChannels(context: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val manager = context.getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(CHANNEL_RING) == null) {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_RING, context.getString(R.string.calls_channel), NotificationManager.IMPORTANCE_HIGH).apply {
              setSound(
                  RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                  AudioAttributes.Builder()
                      .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                      .build(),
              )
              enableVibration(true)
              vibrationPattern = longArrayOf(0, 900, 1100)
              lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
      }
      if (manager.getNotificationChannel(CHANNEL_ONGOING) == null) {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ONGOING, context.getString(R.string.calls_ongoingChannel), NotificationManager.IMPORTANCE_LOW).apply {
              setSound(null, null)
              lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
      }
    }
  }
}
