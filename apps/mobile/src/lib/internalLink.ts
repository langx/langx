import { HANDLE_PATTERN, isOfficialHandle, isReservedHandle, WEB_HOST } from '@langx/shared'

/**
 * What a link to our own web build points at, when it is something the app
 * can open itself. Everything else is `null` and opens in the browser, as any
 * other address would.
 */
export type InternalTarget = { kind: 'profile'; handle: string } | { kind: 'post'; id: string }

export const WEB_ORIGINS = [`https://${WEB_HOST}/`, `http://${WEB_HOST}/`]

/** A post's id is its ObjectId, written out — the shape `postUrl` is given. */
const POST_ID = /^[0-9a-f]{24}$/

/**
 * Reads an address without `new URL`, for the reason `scanTarget` gives:
 * React Native's `URL` is partial. Total, because the input is whatever
 * somebody typed into a chat.
 *
 * Three shapes, and only these:
 *
 *   - `/<handle>` — what `profileUrl` writes, invite links included.
 *   - `/profile/<handle>` — the address bar on the web while a profile is
 *     open, which is what somebody copying "this person" from a browser pastes.
 *   - `/post/<id>` — what `postUrl` writes.
 *
 * A single segment is a profile only if it could be one: every top-level
 * route is a reserved handle, so `/chats` or `/discover` is a screen and not
 * a person called that. The official accounts are the exception — they sit
 * under reserved names on purpose, and `/langx` really is @langx.
 */
export function internalTarget(href: string): InternalTarget | null {
  const lower = href.trim().toLowerCase()
  const origin = WEB_ORIGINS.find((candidate) => lower.startsWith(candidate))
  if (!origin) return null

  const path = lower.slice(origin.length).split(/[?#]/)[0] ?? ''
  // A trailing slash is the same page.
  const segments = (path.endsWith('/') ? path.slice(0, -1) : path).split('/')

  const [first = '', second = ''] = segments
  if (segments.length === 1) {
    if (!HANDLE_PATTERN.test(first)) return null
    if (isReservedHandle(first) && !isOfficialHandle(first)) return null
    return { kind: 'profile', handle: first }
  }
  if (segments.length === 2) {
    if (first === 'profile' && HANDLE_PATTERN.test(second)) {
      return { kind: 'profile', handle: second }
    }
    if (first === 'post' && POST_ID.test(second)) return { kind: 'post', id: second }
  }
  return null
}
