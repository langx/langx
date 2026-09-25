import { PUSH_ACTION_REPLY, PUSH_CATEGORY_MESSAGE } from '@langx/shared'
import { AppState, Platform } from 'react-native'
import { currentTranslate } from '../i18n/runtime'
import { presentationFor } from './foregroundPush'
import {
  belongsTo,
  deliveredAtMs,
  questionsFor,
  staleOnOpen,
  type TrayFacts,
  type TrayScope,
} from './trayScope'

/**
 * Two things that have to be set before the first notification arrives, and
 * are easy to leave out because their absence looks like nothing rather than
 * like an error.
 *
 * Everything here is lazily imported and native-only, for the reason in
 * docs/decisions.md: `expo-notifications` throws on import inside Expo Go on
 * Android, and at module scope that takes the whole layout down.
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')

    /**
     * Without a handler, a notification that arrives while the app is open is
     * delivered to the JS layer and shown nowhere — so someone reading one
     * conversation never learns about a message in another. Both platforms
     * default to silence here; it is a decision, not a default.
     *
     * The exception is a *message* while the app is in front, which becomes
     * the in-app banner instead. A heads-up notification sliding over the app
     * somebody is already using is the most irritating thing this system can
     * do, and it says nothing the banner does not. The badge still ticks, so
     * the count on the icon stays honest.
     *
     * In practice this path only fires when the socket is down while the app
     * is open — the server sends no push to somebody holding a live socket —
     * so the two cannot draw a banner for the same message.
     */
    Notifications.setNotificationHandler({
      handleNotification: (notification) => {
        const suppress =
          presentationFor(notification.request.content.data, AppState.currentState === 'active') ===
          'suppress'
        return Promise.resolve({
          shouldShowBanner: !suppress,
          shouldShowList: !suppress,
          shouldPlaySound: !suppress,
          shouldSetBadge: true,
        })
      },
    })

    /**
     * The Reply box on a message notification.
     *
     * Registered every time this runs rather than once, because the button's
     * word is translated and the person can change their language: a category
     * keeps whatever title it was registered with, so re-registering is how
     * "Reply" becomes "Yanıtla" without a reinstall. Registering the same
     * identifier again replaces it, which is what makes that cheap.
     *
     * The server names this category on every message push
     * (`PUSH_CATEGORY_MESSAGE`). A build that predates this call simply shows
     * the notification without the action.
     */
    const t = currentTranslate()
    await Notifications.setNotificationCategoryAsync(PUSH_CATEGORY_MESSAGE, [
      {
        identifier: PUSH_ACTION_REPLY,
        buttonTitle: t('notifications.replyAction'),
        textInput: {
          submitButtonTitle: t('notifications.replyAction'),
          placeholder: t('notifications.replyPlaceholder'),
        },
        options: {
          /*
           The notification stays put and the app stays closed: answering from
           the shade is the whole point, and opening the app would throw away
           the one thing that made it quick.
          */
          opensAppToForeground: false,
        },
      },
    ])

    if (Platform.OS === 'android') {
      /**
       * Android 8+ drops any notification that names no channel, and the
       * importance is fixed when the channel is created — raising it later has
       * no effect on a device that already has it. `HIGH` is what makes a
       * message notification appear as a heads-up banner rather than a silent
       * row in the shade.
       */
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages and reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        // The unread count on the icon, where the launcher draws one. Whether
        // it is a number or a dot is the launcher's decision, not the app's.
        showBadge: true,
      })
    }
  } catch {
    // A device that cannot be configured for notifications still runs the app.
  }
}

/**
 * Takes what was just read out of the OS shade. See `trayScope.ts` for what
 * counts.
 *
 * Only notifications this device is still showing are touched, so it is safe
 * to call on every read, and never throws: a stale row in the shade is not
 * worth failing a read receipt over.
 */
export async function clearFromTray(scope: TrayScope): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    const presented = await Notifications.getPresentedNotificationsAsync()
    await Promise.all(
      presented
        .filter((n) => belongsTo(n.request.content.data, scope))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    )
  } catch {
    // See above.
  }
}

/**
 * Takes out of the shade whatever has been dealt with since it was drawn,
 * however that happened. See `TrayFacts` for why `clearFromTray` alone is not
 * enough.
 *
 * `ask` fetches the answers and lives with the caller, which has the API
 * client. Never throws, for the reason `clearFromTray` gives.
 */
export async function sweepTray(
  ask: (questions: ReturnType<typeof questionsFor>) => Promise<TrayFacts>,
): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Notifications = await import('expo-notifications')
    const presented = await Notifications.getPresentedNotificationsAsync()
    if (presented.length === 0) return
    const facts = await ask(questionsFor(presented.map((n) => n.request.content.data)))
    const now = Date.now()
    await Promise.all(
      presented
        .filter((n) => staleOnOpen(n.request.content.data, deliveredAtMs(n.date), facts, now))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    )
  } catch {
    // See above.
  }
}
