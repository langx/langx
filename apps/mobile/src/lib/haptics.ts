import { Platform } from 'react-native'

/**
 * A tap you can feel.
 *
 * `expo-haptics` is imported lazily, the same way every native module that the
 * web bundle must not see is. Neither function may ever throw — a missing
 * buzz is not a reason to lose a gift — so every failure is swallowed, and on
 * web both are no-ops by construction.
 *
 * When to buzz — at most one haptic per user action:
 *
 *   Call                     When
 *   selection()              The press changed a value: a toggle, segment,
 *                            radio, chip, plan card, Echo grade, sort.
 *   impact('light')          A gesture crossed its commit threshold (reply
 *                            swipe, row open), a drag lifted, a deliberate
 *                            tap has no visual commit yet (double-tap
 *                            react), or a pull-to-refresh caught.
 *   impact('medium')         A long-press menu opens, the shutter, recording
 *                            starts, a gift box is pressed. For the gift, the
 *                            press or the reveal, never both.
 *   notification('success')  Once per reward or celebration, claimed through
 *                            `claimCelebration`.
 *   notification('error')    An action the person committed to then failed:
 *                            sign-in, send, claim.
 *   never                    Plain navigation, tab switches, scrolling,
 *                            typing, timers, a toast without a reward. Never
 *                            more than one per event.
 *
 * A buzz on everything is a buzz on nothing: it only tells someone what
 * happened if most presses stay silent.
 */
export type ImpactStyle = 'light' | 'medium' | 'heavy'
export type NotificationType = 'success' | 'warning' | 'error'

export async function impact(style: ImpactStyle = 'medium'): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Haptics = await import('expo-haptics')
    const styles = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }
    await Haptics.impactAsync(styles[style])
  } catch {
    // No module, or a device without a motor.
  }
}

export async function notification(type: NotificationType = 'success'): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Haptics = await import('expo-haptics')
    const types = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    }
    await Haptics.notificationAsync(types[type])
  } catch {
    // Same as above.
  }
}

/**
 * A choice moving from one option to another — the paywall's plan cards.
 * Lighter than `impact`, because nothing has been committed yet.
 */
export async function selection(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    const Haptics = await import('expo-haptics')
    await Haptics.selectionAsync()
  } catch {
    // Same as above.
  }
}
