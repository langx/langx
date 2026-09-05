/**
 * A tap you can feel.
 *
 * No-ops for now: `expo-haptics` is a native module and arrives with the
 * store build that also brings the accelerometer. The gift screen calls these
 * at the moments that want feedback so the build only has to fill in the
 * bodies. Both stay no-ops on web, and neither may ever throw — a missing
 * buzz is not a reason to lose a gift.
 */
export type ImpactStyle = 'light' | 'medium' | 'heavy'
export type NotificationType = 'success' | 'warning' | 'error'

export async function impact(_style: ImpactStyle = 'medium'): Promise<void> {}

export async function notification(_type: NotificationType = 'success'): Promise<void> {}
