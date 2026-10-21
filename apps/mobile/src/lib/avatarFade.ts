/**
 * Whether an avatar's picture dissolves in, or is simply there.
 *
 * A face arriving from the network is softened by a short dissolve over the
 * grey it was waiting on. But expo-image plays its `transition` on every load
 * — a memory-cache hit included, on iOS and Android alike — so a face set to
 * fade always would fade again each time its view is created: a list row
 * scrolled back into the window, a screen opened a second time. A face
 * already seen would blink on every return, which is the flicker the fade
 * was meant to hide. So it fades the first time this launch shows that
 * picture, and never again.
 *
 * Kept by URI for the life of the JS runtime. Pure, so vitest can reach it.
 */
export const AVATAR_FADE_MS = 120

const shown = new Set<string>()

/** The `transition` for a view about to show `uri`: a fade only if nothing has shown it yet. */
export function avatarFadeMs(uri: string): number {
  return shown.has(uri) ? 0 : AVATAR_FADE_MS
}

/** Called once the picture has loaded, so every later view of it skips the fade. */
export function markAvatarShown(uri: string): void {
  shown.add(uri)
}

export function resetAvatarFadeForTest(): void {
  shown.clear()
}
