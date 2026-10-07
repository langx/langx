import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useTheme } from '../lib/theme'
import type { TurnstileProps } from './Turnstile'

/** The slice of Cloudflare's global this file calls. */
interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string | undefined
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<TurnstileApi> | null = null

/**
 * One script tag for the life of the page, however many forms mount a widget.
 * A failed load is forgotten so the next mount tries again rather than
 * inheriting the rejection forever.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing'))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Cloudflare Turnstile in the browser: the same widget as `Turnstile.tsx`
 * without the WebView, rendered straight into this `View`'s element — on the
 * web a React Native `View` *is* a `div`.
 *
 * `interaction-only` keeps it out of sight unless Cloudflare needs a click,
 * in which case it draws itself into the element at its own size. See the
 * native file for why `refresh-expired` is `auto`.
 */
export function Turnstile({ siteKey, onToken, onExpire, onError }: TurnstileProps) {
  const { scheme } = useTheme()
  const ref = useRef<View>(null)
  // Out of the flow until Cloudflare asks for a click, for the reason the
  // native file gives: the forms space their blocks with `gap`.
  const [interactive, setInteractive] = useState(false)
  const handlers = useRef({ onToken, onExpire, onError })
  handlers.current = { onToken, onExpire, onError }

  useEffect(() => {
    let cancelled = false
    let widgetId: string | undefined
    loadTurnstile()
      .then((turnstile) => {
        const element = ref.current as unknown as HTMLElement | null
        if (cancelled || !element) return
        widgetId = turnstile.render(element, {
          sitekey: siteKey,
          theme: scheme,
          appearance: 'interaction-only',
          'refresh-expired': 'auto',
          callback: (token: string) => {
            setInteractive(false)
            handlers.current.onToken(token)
          },
          'expired-callback': () => handlers.current.onExpire(),
          'error-callback': () => {
            handlers.current.onError()
            // Handled: without this Turnstile also throws it to the console.
            return true
          },
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
        })
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError()
      })
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, scheme])

  return (
    <View
      ref={ref}
      style={
        interactive
          ? { alignItems: 'center' }
          : { position: 'absolute', left: 0, right: 0, height: 0, overflow: 'hidden' }
      }
    />
  )
}
