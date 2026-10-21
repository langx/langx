/**
 * Whether the v3 composer's row draws the mic beside the field.
 *
 * Not while a typed draft is waiting. The mic records only from an empty
 * composer, so beside a draft it is a disabled 56pt disc, and with Copilot's
 * button joining the row once there is text, the field was left with about
 * half the row: a sentence wrapped every three words. The send keeps its
 * place at the row's end either way, so the thumb's target does not move; the
 * field takes the mic's slot, and gives it back when the draft is sent or
 * cleared.
 *
 * Kept while a note records (the mic is its stop button) and while only a
 * picked file waits — the field is empty then, so there is nothing to make
 * room for.
 *
 * Pure, without react-native, so vitest can hold it.
 */
export function composerShowsMic({
  value,
  recording,
}: {
  value: string
  recording: boolean
}): boolean {
  return recording || value.trim().length === 0
}
