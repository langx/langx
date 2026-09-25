import * as TaskManager from 'expo-task-manager'
import { applyTraySync, TRAY_SYNC_TASK } from './notifications'
import { traySyncFrom } from './trayScope'

/**
 * The background half of the silent push: a read on another device, applied
 * to this phone's shade while the app is not running. See `TraySync`.
 *
 * Defined here, at module scope, and imported by `index.ts` before anything
 * else can run. iOS and Android both start the app just to run this, with no
 * screen and no layout, and `expo-task-manager` unregisters a task that is
 * asked for before it has been defined, so a definition that waited for a
 * screen would be lost after the first silent push.
 *
 * `configureNotifications` registers it. Web has its own empty twin,
 * `traySyncTask.web.ts`, so this package never reaches the browser bundle.
 */
TaskManager.defineTask(TRAY_SYNC_TASK, async ({ data }) => {
  const sync = traySyncFrom(data)
  if (sync) await applyTraySync(sync)
})
