import { CALL_LIMITS, ERROR_CODES, iceConfigSchema, type IceConfig } from '@langx/shared'
import { z } from 'zod'
import type { Env } from '../../env'
import { ApiError } from '../../lib/ApiError'

/**
 * Where a call's media is allowed to travel, minted fresh for each person in
 * each call.
 *
 * The API never carries media. What it hands out is the address of a relay
 * and a credential for it that expires soon after the longest call could end
 * — so a credential copied out of one call is useless for squatting on the
 * relay afterwards, and the long-lived key that mints them never leaves the
 * server.
 */
export interface IceServerProvider {
  /**
   * Whether a call can be placed at all. `/app-config` reports it as
   * `callService`, so the app never draws a button this would refuse.
   */
  readonly configured: boolean
  mint(): Promise<IceConfig>
}

/** How long a credential stays good: the longest call, and a margin to hang up in. */
export const ICE_TTL_SECONDS =
  (CALL_LIMITS.maxDurationMinutes + CALL_LIMITS.turnTtlMarginMinutes) * 60

/**
 * Mirrors `NotConfiguredSttProvider`: the app boots and everything else works.
 * `mint` still refuses rather than answering with an empty list, so a client
 * that ignored `callService` is told why instead of dialling into nothing.
 */
export class NotConfiguredIceProvider implements IceServerProvider {
  readonly configured = false

  mint(): Promise<IceConfig> {
    return Promise.reject(
      new ApiError(ERROR_CODES.CALLS_UNAVAILABLE, 'Calls are not available on this server'),
    )
  }
}

/**
 * A fixed list: a self-hosted coturn, or nothing at all on a developer's own
 * machine, where two browsers find each other without help.
 */
export class StaticIceProvider implements IceServerProvider {
  readonly configured = true
  readonly #config: IceConfig

  constructor(config: IceConfig) {
    this.#config = config
  }

  mint(): Promise<IceConfig> {
    return Promise.resolve(this.#config)
  }
}

const cloudflareResponseSchema = z.object({ iceServers: iceConfigSchema.shape.iceServers })

/** How long to wait for the relay's API before telling the caller it is down. */
const MINT_TIMEOUT_MS = 3000

/**
 * Cloudflare's TURN service: one HTTPS call returns a short-lived credential
 * and the anycast addresses to use it at.
 *
 * `relay` is the policy, always. With it a device gathers no candidate that
 * names its own address — every packet goes by way of the relay — so calling
 * somebody never tells them, or tells us, where the other is. It costs a hop
 * and it is why the relay is not optional in production: without one there is
 * no path at all, which is the honest failure, rather than a call that works
 * by handing two strangers each other's IP.
 */
export class CloudflareTurnProvider implements IceServerProvider {
  readonly configured = true
  readonly #endpoint: string
  readonly #apiToken: string
  readonly #fetch: typeof fetch

  constructor(keyId: string, apiToken: string, fetchImpl: typeof fetch = fetch) {
    this.#endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`
    this.#apiToken = apiToken
    this.#fetch = fetchImpl
  }

  async mint(): Promise<IceConfig> {
    let response: Response
    try {
      response = await this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ttl: ICE_TTL_SECONDS }),
        signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
      })
    } catch {
      // Unreachable or slow. Nothing about why is the caller's to read.
      throw new ApiError(ERROR_CODES.CALLS_UNAVAILABLE, 'Calls are not available right now')
    }
    if (!response.ok) {
      throw new ApiError(ERROR_CODES.CALLS_UNAVAILABLE, 'Calls are not available right now')
    }

    const parsed = cloudflareResponseSchema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(ERROR_CODES.CALLS_UNAVAILABLE, 'Calls are not available right now')
    }
    return { iceServers: parsed.data.iceServers, iceTransportPolicy: 'relay' }
  }
}

/** Whether any server in the list is a relay rather than only a way to learn an address. */
function hasRelay(config: Pick<IceConfig, 'iceServers'>): boolean {
  return config.iceServers.some((server) =>
    (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => /^turns?:/.test(url)),
  )
}

/**
 * Which provider this process runs with.
 *
 * Cloudflare when its two values are set. Otherwise a list given outright in
 * `ICE_SERVERS_JSON` — for somebody running their own relay — which is
 * relay-only whenever it contains one, for the reason above.
 *
 * With neither, the answer depends on where this is. In production there is
 * no call service: see `CloudflareTurnProvider` for why a call without a relay
 * is not offered. Anywhere else, an empty list and no restriction, which is
 * enough for two devices on one network to call each other and is what lets
 * the whole flow be developed and tested with nothing configured.
 */
export function createIceProvider(env: Env): IceServerProvider {
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_KEY_API_TOKEN) {
    return new CloudflareTurnProvider(env.CLOUDFLARE_TURN_KEY_ID, env.CLOUDFLARE_TURN_KEY_API_TOKEN)
  }
  if (env.ICE_SERVERS_JSON) {
    return new StaticIceProvider({
      iceServers: env.ICE_SERVERS_JSON,
      iceTransportPolicy: hasRelay({ iceServers: env.ICE_SERVERS_JSON }) ? 'relay' : 'all',
    })
  }
  if (env.NODE_ENV === 'production') return new NotConfiguredIceProvider()
  return new StaticIceProvider({ iceServers: [], iceTransportPolicy: 'all' })
}
