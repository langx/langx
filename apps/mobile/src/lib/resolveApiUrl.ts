const FALLBACK = 'http://localhost:4000'

/** Hosts that mean "this machine", which is the wrong machine on a phone. */
function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

/**
 * Where the API is, from the point of view of whatever this build is running
 * on.
 *
 * `EXPO_PUBLIC_API_URL` is the answer everywhere except one case, and it is
 * the case where the app is hardest to debug: a development build on a real
 * phone. `localhost` there is the phone, so every request fails with a network
 * error, the sign-in screen says nothing useful, and the obvious conclusion is
 * that the API is broken. The dev server already knows the right address —
 * it is the one Metro is being reached on — so in development we take the host
 * from there and keep the API's port.
 *
 * Only in development, and only when the configured URL is a loopback address.
 * A build with a real API URL is left alone, so this can never rewrite
 * production traffic to some address a bundler happened to report.
 */
export function resolveApiUrl(
  configured: string | undefined,
  hostUri: string | undefined,
  dev: boolean,
  isWeb: boolean,
): string {
  const base = configured ?? FALLBACK
  // On web, loopback is correct: the browser is on the same machine as the API.
  if (!dev || isWeb || !hostUri) return base

  let url: URL
  try {
    url = new URL(base)
  } catch {
    return base
  }
  if (!isLoopback(url.hostname)) return base

  // `hostUri` is "host:port" (Metro's port, not ours) and can itself be
  // loopback — an emulator, or a tunnel — in which case there is nothing
  // better to offer and rewriting would only make it worse.
  const host = hostUri.split(':')[0]
  if (!host || isLoopback(host)) return base

  url.hostname = host
  return url.origin
}
