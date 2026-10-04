import type { IceConfig } from '@langx/shared'

/**
 * The relay list as a browser will accept it.
 *
 * The relay offers itself on several ports so that something gets through
 * whatever a network blocks, and one of them is 53 — DNS's port, open almost
 * everywhere. A native media engine will use it. A browser will not: 53 is on
 * the list of ports a page may never connect to, and Chrome and Firefox both
 * refuse the *whole* `RTCPeerConnection` configuration when it names one,
 * rather than skipping that entry. So on the web those addresses are taken
 * out, and the others carry the call.
 *
 * Takes the platform rather than reading it, for the reason every pure module
 * here does: this file is loaded by the unit tests, which cannot load
 * `react-native`.
 */
export function iceConfigFor(config: IceConfig, platform: string): IceConfig {
  if (platform !== 'web') return config
  return {
    ...config,
    iceServers: config.iceServers
      .map((server) => {
        const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(
          (url) => !usesPort53(url),
        )
        return { ...server, urls }
      })
      .filter((server) => server.urls.length > 0),
  }
}

/** `turn:host:53?transport=udp` and `stun:host:53` — the port, not a `53` in the name. */
function usesPort53(url: string): boolean {
  return /:53(\?|$)/.test(url)
}
