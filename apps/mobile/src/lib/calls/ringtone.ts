/**
 * The sounds a call makes while it waits: a ring for the person being called,
 * and the tone the caller hears while it rings.
 *
 * Nothing on a phone, in this build. A phone that is being called is rung by
 * the system's own call screen, with the system's ringtone, and that arrives
 * with the native module — along with everything else a phone needs to take a
 * call. `ringtone.web.ts` is the one that makes a sound.
 */
export function startRinging(_kind: 'incoming' | 'outgoing', _label?: string): void {}

export function stopRinging(): void {}
