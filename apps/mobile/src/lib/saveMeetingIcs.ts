import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { meetingIcs, type MeetingEvent } from './icsFile'

/**
 * Hands an accepted meeting to whatever keeps this person's calendar.
 *
 * Two platforms, two gestures, one file. On a phone the share sheet is the
 * route into a calendar — iOS and Android both offer "Add to Calendar" for an
 * `text/calendar` item — and on the web it is an ordinary download, which is
 * what every calendar app has imported for twenty years.
 *
 * Returns `false` when nothing could be opened, so the caller can say so
 * rather than leaving a button that appears to do nothing. Cancelling is not a
 * failure: `expo-sharing` resolves on cancel, the same reason `shareImage`
 * has no cancel branch.
 */
export async function saveMeetingIcs(event: MeetingEvent): Promise<boolean> {
  const ics = meetingIcs(event)
  const name = `langx-${event.uid}.ics`

  if (Platform.OS === 'web') {
    try {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      // Revoked on the next tick, not immediately: Safari has not started
      // reading the blob when `click()` returns.
      setTimeout(() => URL.revokeObjectURL(url), 0)
      return true
    } catch {
      return false
    }
  }

  try {
    if (!(await Sharing.isAvailableAsync())) return false
    const file = new File(Paths.cache, name)
    // Overwritten rather than appended: accepting, undoing and accepting again
    // must not land on a file with two events in it.
    if (file.exists) file.delete()
    file.create()
    file.write(ics)
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/calendar',
      UTI: 'com.apple.ical.ics',
    })
    return true
  } catch {
    return false
  }
}
