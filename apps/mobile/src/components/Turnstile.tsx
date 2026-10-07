import { useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { useTheme } from '../lib/theme'

export interface TurnstileProps {
  siteKey: string
  /** A fresh token. Single-use: the form spends it on one request. */
  onToken: (token: string) => void
  /** The token went stale (five minutes); a new one follows on its own. */
  onExpire: () => void
  /** The widget could not produce a token at all. */
  onError: () => void
}

/**
 * Where the widget believes it is. Turnstile does not run natively — it is a
 * script that has to be in a page — so the native app hosts a one-element page
 * in a WebView, and a site key only works on the hostnames its widget lists.
 * Ours lists langx.io and its subdomains, and the web app's own host is the
 * honest answer: the widget then reports the same hostname from either client.
 * Nothing is fetched from it; the HTML below is the whole page.
 */
const BASE_URL = 'https://app.langx.io'

/** Turnstile's own box, which is what the WebView has to fit when it shows. */
const WIDGET_HEIGHT = 70

/**
 * Collapsed, the widget is taken out of the flow as well as given no height:
 * the auth forms lay their blocks out with `gap`, and an empty child in that
 * column would still add a gap's worth of space above the button.
 */
const COLLAPSED = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 0,
  overflow: 'hidden',
} as const
const OPEN = { height: WIDGET_HEIGHT, overflow: 'hidden' } as const

/**
 * Cloudflare Turnstile on iOS and Android, in a WebView.
 *
 * `appearance: 'interaction-only'` keeps it invisible for the great majority,
 * who are passed without being asked anything; the WebView is laid out at zero
 * height and only opens to the widget's size when Cloudflare says a person has
 * to click (`before-interactive-callback`). It still runs while collapsed —
 * it is in the tree, merely clipped.
 *
 * `refresh-expired: 'auto'` is the refresh: a token lives five minutes, and
 * somebody who leaves the form open longer gets a new one without doing
 * anything. Expiry is reported so the form stops holding the stale one.
 *
 * Cloudflare's WebView requirements — JavaScript, DOM storage, cookies, a user
 * agent that does not change mid-session — are what `react-native-webview`
 * does by default; they are spelled out below only so nobody "tidies" one off.
 * The web build renders `Turnstile.web.tsx` instead and never loads this file.
 */
export function Turnstile({ siteKey, onToken, onExpire, onError }: TurnstileProps) {
  const { scheme } = useTheme()
  const [interactive, setInteractive] = useState(false)
  // Through a ref so that a parent re-rendering with new closures does not
  // rebuild the page and throw away a challenge in progress.
  const handlers = useRef({ onToken, onExpire, onError })
  handlers.current = { onToken, onExpire, onError }

  const html = useMemo(() => page(siteKey, scheme), [siteKey, scheme])

  function onMessage(event: WebViewMessageEvent): void {
    let message: { type?: string; token?: string }
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message
    } catch {
      return
    }
    switch (message.type) {
      case 'token':
        if (message.token) handlers.current.onToken(message.token)
        setInteractive(false)
        break
      case 'expired':
        handlers.current.onExpire()
        break
      case 'error':
        handlers.current.onError()
        break
      case 'interactive':
        setInteractive(true)
        break
      case 'idle':
        setInteractive(false)
        break
    }
  }

  return (
    <View style={interactive ? OPEN : COLLAPSED}>
      <WebView
        style={{ height: WIDGET_HEIGHT, backgroundColor: 'transparent' }}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        // Network trouble loading the script, rather than a challenge failing.
        onError={() => handlers.current.onError()}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        scrollEnabled={false}
        // Transparent, so nothing flashes white in dark mode as it opens.
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  )
}

/**
 * The page. The site key is public by design and the theme is one of two
 * words, so both are safe to write into the HTML as JSON literals.
 *
 * The load callback is defined before the script tag that calls it: the tag is
 * `async`, and an `onload=` name that does not exist yet when the script runs
 * is silently never called.
 */
function page(siteKey: string, scheme: 'light' | 'dark'): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;background:transparent}body{display:flex;justify-content:center}</style>
<script>
function send(message){window.ReactNativeWebView.postMessage(JSON.stringify(message))}
function onTurnstileLoad(){
  turnstile.render('#widget',{
    sitekey:${JSON.stringify(siteKey)},
    theme:${JSON.stringify(scheme)},
    appearance:'interaction-only',
    'refresh-expired':'auto',
    callback:function(token){send({type:'token',token:token})},
    'expired-callback':function(){send({type:'expired'})},
    'error-callback':function(){send({type:'error'});return true},
    'before-interactive-callback':function(){send({type:'interactive'})},
    'after-interactive-callback':function(){send({type:'idle'})}
  })
}
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad" async defer></script>
</head><body><div id="widget"></div></body></html>`
}
