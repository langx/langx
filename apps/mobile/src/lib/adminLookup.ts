/**
 * The Copilot page's "Add an account" lookup, decided away from the screen so
 * it can be tested — mobile vitest cannot load a component.
 */

/** What is sent for what was typed: no spaces around it and no leading "@". */
export function adminLookupKey(typed: string): string {
  return typed.trim().replace(/^@/, '').trim()
}

export type AdminLookupState = 'idle' | 'searching' | 'found' | 'notFound' | 'error'

/**
 * Which of the five the field is in.
 *
 * `lookup` is the debounced key the query was asked for. While the typing has
 * not settled into it yet the answer on screen belongs to an older key, so it
 * is "searching" — never "not found" for a name still being typed. And only a
 * 404 is "not found": a 500 or a dropped connection said nothing about
 * whether the account exists, and reading it as "nobody" was how the page
 * hid its failures.
 */
export function adminLookupState(input: {
  typed: string
  lookup: string
  hasData: boolean
  isFetching: boolean
  error: unknown
}): AdminLookupState {
  const key = adminLookupKey(input.typed)
  if (key.length < 2) return 'idle'
  if (key !== input.lookup) return 'searching'
  // A refetch that says the account is gone wins over the answer it replaces.
  if (input.error && isNotFound(input.error)) return 'notFound'
  // A refetch after a toggle keeps the row and its button on screen.
  if (input.hasData) return 'found'
  if (input.isFetching) return 'searching'
  if (input.error) return isNotFound(input.error) ? 'notFound' : 'error'
  return 'searching'
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}
