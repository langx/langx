package expo.modules.carmessaging

import android.content.Context
import expo.modules.notifications.service.NotificationsService
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
 */
class MessageNotificationsService : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate =
      MessagePresenter(context)
}
