package expo.modules.carmessaging

import android.content.Context
import expo.modules.calls.CallPush
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.interfaces.HandlingDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate

/**
 * The app's own notification pipeline, which is Expo's with one thing swapped.
 *
 * Registered in this module's manifest at the default priority; Expo's own
 * receiver sits at -1 so that this one is found first. See the manifest for
 * how that resolution works.
 *
 * Nothing else is overridden. Scheduling, dismissal, categories, the boot
 * re-registration and the whole response path stay exactly as they were —
 * this class exists so that a *message* is drawn as a conversation rather
 * than as a line of text, and so it can be answered from a car.
 *
 * And so that a call can ring. A call's ring is a data-only push, which Expo
 * hands to no presenter and, with the app in the background, to no
 * JavaScript either: the handling delegate is the one place it passes
 * through. Everything that is not a call goes on to Expo's own delegate
 * unchanged.
 */
class MessageNotificationsService : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate =
      MessagePresenter(context)

  override fun getHandlingDelegate(context: Context): HandlingDelegate {
    val expo = super.getHandlingDelegate(context)
    return object : HandlingDelegate by expo {
      override fun handleNotification(notification: Notification) {
        if (CallPush.handle(context, notification.notificationRequest.content.body)) return
        expo.handleNotification(notification)
      }
    }
  }
}
