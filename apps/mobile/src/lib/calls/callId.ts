/**
 * A UUID for a call, minted on the device that places it.
 *
 * The server keys the call on it and so does a phone's own call screen, which
 * accepts nothing but a UUID — see `callIdSchema`. `crypto.randomUUID` where
 * there is one. Hermes has no such function, so the fallback builds a version
 * 4 UUID by hand from whatever randomness the runtime does have.
 *
 * It does not need to be unguessable. Nothing is authorised by knowing a call's
 * id: every request about a call is checked against who is in it. What it has
 * to be is different from every other call's, and 122 random bits are that.
 */
export function newCallId(): string {
  const native = globalThis.crypto?.randomUUID?.()
  if (native) return native

  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

  // The two fields that make it a version 4, variant 1 UUID.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
