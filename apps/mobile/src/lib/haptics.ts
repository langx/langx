import { Platform } from 'react-native'

/**
 * A tap you can feel.
 *
 * `expo-haptics` is imported lazily, the same way every native module that the
 * web bundle must not see is. Neither function may ever throw — a missing
 * buzz is not a reason to lose a gift — so every failure is swallowed, and on
 * web both are no-ops by construction.
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
