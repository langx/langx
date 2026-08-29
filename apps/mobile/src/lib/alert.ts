/**
 * Dialogs that exist on every platform.
 *
 * `Alert` from react-native is `class Alert { static alert() {} }` on
 * react-native-web — an empty function. Every confirmation in this app was
 * therefore a no-op in the browser, and the ones carrying an `onPress` were
 * worse than silent: "Delete my account" raised a dialog that never appeared,
 * so the callback behind it never ran and the button did nothing at all.
 *
 * The fix is one dialog of our own rather than a platform switch. `window.confirm`
 * would cover the two-button cases and not the report picker, which offers three
 * reasons, and a UI that diverges by platform is a UI that gets tested on one of
 * them. `AlertHost` renders these requests with `Modal`, which react-native-web
 * does implement.
 *
 * This module is the state, deliberately separate from the component that draws
 * it: everything decided here is a pure function of a queue, and `src/lib` is the
 * only place the test setup can reach.
 */

import { currentTranslate } from '../i18n/runtime'
export interface AlertButton<T = void> {
  label: string
  /** Resolves the request with this when pressed. */
  value: T
  /** `cancel` is also what dismissing resolves to. `destructive` reads red. */
  style?: 'default' | 'cancel' | 'destructive'
}

export interface AlertRequest<T = unknown> {
  id: number
  title: string
  message?: string
  buttons: AlertButton<T>[]
}

type Listener = (request: AlertRequest<unknown> | null) => void

let nextId = 1
let queue: { request: AlertRequest<unknown>; resolve: (value: never) => void }[] = []
let listener: Listener | null = null

function publish(): void {
  listener?.(queue[0]?.request ?? null)
}

/** `AlertHost` subscribes; the returned function unsubscribes. */
export function subscribeToAlerts(next: Listener): () => void {
  listener = next
  publish()
  return () => {
    if (listener === next) listener = null
  }
}

/**
 * Shows a dialog and resolves with the pressed button's value.
 *
 * Requests queue rather than replace each other. Two failures arriving together
 * — an upload that fails while a quota warning is still up — must not leave the
 * user having seen only one of them.
 */
export function askAlert<T>(
  title: string,
  message: string | undefined,
  buttons: AlertButton<T>[],
): Promise<T> {
  return new Promise<T>((resolve) => {
    queue = [
      ...queue,
      {
        request: { id: nextId++, title, message, buttons } as AlertRequest<unknown>,
        resolve,
      },
    ]
    publish()
  })
}

/** Called by `AlertHost` when a button is pressed or the dialog is dismissed. */
export function resolveAlert(id: number, value: unknown): void {
  const entry = queue.find((each) => each.request.id === id)
  if (!entry) return
  queue = queue.filter((each) => each.request.id !== id)
  entry.resolve(value as never)
  publish()
}

/** What dismissing a dialog means: the cancel button, or nothing. */
export function dismissValue<T>(buttons: AlertButton<T>[]): T | undefined {
  return buttons.find((b) => b.style === 'cancel')?.value
}

/** A message with nothing to decide. */
export function showAlert(title: string, message?: string): Promise<void> {
  return askAlert<void>(title, message, [
    { label: currentTranslate()('common.ok'), value: undefined },
  ])
}

/** A yes/no question. Dismissing counts as no. */
export function confirmAlert(options: {
  title: string
  message?: string
  confirmLabel: string
  destructive?: boolean
}): Promise<boolean> {
  return askAlert<boolean>(options.title, options.message, [
    { label: currentTranslate()('common.cancel'), value: false, style: 'cancel' },
    {
      label: options.confirmLabel,
      value: true,
      style: options.destructive ? 'destructive' : 'default',
    },
  ])
}

/** One of several choices, or `null` when cancelled. */
export function chooseAlert<T extends string>(
  title: string,
  message: string | undefined,
  choices: { label: string; value: T }[],
): Promise<T | null> {
  return askAlert<T | null>(title, message, [
    ...choices.map((c) => ({ label: c.label, value: c.value })),
    { label: currentTranslate()('common.cancel'), value: null, style: 'cancel' as const },
  ])
}

/** Test seam: drops any queued request without resolving it. */
export function resetAlertsForTest(): void {
  queue = []
  listener = null
  nextId = 1
}
