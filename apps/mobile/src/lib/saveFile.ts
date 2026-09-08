import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { icsFileName, meetingIcs, type MeetingEvent } from './icsFile'

/**
 * An accepted meeting as a downloadable file.
 *
 * The web's whole answer — a browser has no calendar to write to, and an
 * `.ics` is what every calendar app has imported for twenty years — and the
 * fallback on a phone whose calendar could not be reached. `addToCalendar.ts`
 * is the ordinary path there now.
 *
 * Returns `false` when nothing could be opened, so the caller can say so
 * rather than leaving a button that appears to do nothing. Cancelling is not a
 * failure: `expo-sharing` resolves on cancel, the same reason `shareImage`
 * has no cancel branch.
 */
export async function saveMeetingIcs(event: MeetingEvent): Promise<boolean> {
  return saveTextFile(meetingIcs(event), icsFileName(event), {
    mimeType: 'text/calendar',
    uti: 'com.apple.ical.ics',
  })
}

/**
 * Writes a text file and hands it to whatever wants it.
 *
 * Shared by the calendar file and the phrase deck, which want the same two
 * gestures and differ only in what the bytes are called.
 */
export async function saveTextFile(
  contents: string,
  name: string,
  type: { mimeType: string; uti: string },
): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const url = URL.createObjectURL(
        new Blob([contents], { type: `${type.mimeType};charset=utf-8` }),
      )
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
    file.write(contents)
    await Sharing.shareAsync(file.uri, { mimeType: type.mimeType, UTI: type.uti })
    return true
  } catch {
    return false
  }
}
