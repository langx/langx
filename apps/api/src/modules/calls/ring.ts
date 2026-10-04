import {
  CALL_CANCEL_KIND,
  CALL_RING_KIND,
  DEFAULT_LOCALE,
  type ApnsEnvironment,
  type CallEndReason,
  type CallPeer,
  type CallRingData,
  type Locale,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { translator } from '../../i18n'
import { devicesFor, sendCallSignalPush, sendPush, type Device } from '../push/devices'
import { CALL_TOKEN_GRACE_SECONDS, signCallToken } from './callToken'
import type { Call } from './calls'
import { callEndpointsFor, dropVoipToken, type CallEndpoint } from './endpoints'

/**
 * Every way one account's phones can be rung while their apps are closed.
 *
 * Three lists because there are three mechanisms, and which one a phone gets
 * is decided by what the phone told us about itself — never by the server
 * guessing from a version number.
 */
export interface RingTargets {
  /** iPhones that show the system's call screen: a VoIP push, straight to Apple. */
  voip: { token: string; environment: ApnsEnvironment }[]
  /** Android phones with the native ringer: a data push through Expo's relay. */
  android: string[]
  /**
   * iPhones that cannot be rung the first way — the system call screen is not
   * allowed where they are, or this deployment has no key for Apple. They get
   * an ordinary notification in their own language.
   */
  fallback: { token: string; locale: Locale }[]
}

export function hasRingTargets(targets: RingTargets): boolean {
  return targets.voip.length > 0 || targets.android.length > 0 || targets.fallback.length > 0
}

/**
 * Sorts an account's phones into the three lists.
 *
 * An endpoint is the phone saying "I can be rung"; a device row is the phone
 * having allowed notifications and not switched them off for itself. Android
 * and the fallback both travel as notifications-in-waiting through Expo, so
 * they need the device row — a phone silenced with its own switch stays
 * silent. A VoIP push needs neither the row nor the permission, which is the
 * whole reason endpoints are their own collection.
 *
 * `exceptDeviceId` is the phone that just answered, when the others are being
 * told to stop.
 */
export function ringTargets(
  endpoints: readonly CallEndpoint[],
  devices: readonly Device[],
  voipConfigured: boolean,
  exceptDeviceId?: string,
): RingTargets {
  const targets: RingTargets = { voip: [], android: [], fallback: [] }
  const deviceOf = new Map(
    devices.flatMap((device) => (device.deviceId ? [[device.deviceId, device] as const] : [])),
  )

  for (const endpoint of endpoints) {
    if (endpoint.deviceId === exceptDeviceId) continue
    const device = deviceOf.get(endpoint.deviceId)

    if (endpoint.platform === 'android') {
      if (device?.platform === 'android') targets.android.push(device.pushToken)
      continue
    }
    if (voipConfigured && endpoint.voip && endpoint.callKit !== false) {
      targets.voip.push(endpoint.voip)
      continue
    }
    if (device?.platform === 'ios') {
      targets.fallback.push({ token: device.pushToken, locale: device.locale ?? DEFAULT_LOCALE })
    }
  }
  return targets
}

export async function loadRingTargets(
  app: FastifyInstance,
  userId: string,
  exceptDeviceId?: string,
): Promise<RingTargets> {
  const [endpoints, devices] = await Promise.all([
    callEndpointsFor(app.mongo.db, userId),
    devicesFor(app.mongo.db, userId),
  ])
  return ringTargets(endpoints, devices, app.voip.configured, exceptDeviceId)
}

/**
 * Rings the phones.
 *
 * Best-effort in every branch, for `fanOutMessage`'s reason: the call is
 * already written and already ringing on every open app. A push provider's
 * bad minute must cost one way of being reached, not the call.
 */
export async function ringPhones(
  app: FastifyInstance,
  call: Call,
  caller: CallPeer,
  targets: RingTargets,
  now: Date = new Date(),
): Promise<void> {
  if (!hasRingTargets(targets)) return
  const db = app.mongo.db

  // Relative, so no phone's clock has to agree with ours about when to stop.
  const ringSeconds = Math.max(1, Math.ceil((call.ringDeadline.getTime() - now.getTime()) / 1000))
  const data: CallRingData = {
    kind: CALL_RING_KIND,
    callId: call._id,
    conversationId: call.conversationId.toHexString(),
    media: call.media,
    callerId: caller._id,
    callerName: caller.displayName,
    callerHandle: caller.handle,
    ...(caller.avatarUrl ? { callerAvatarUrl: caller.avatarUrl } : {}),
    ringSeconds,
    callToken: signCallToken(app.env.BETTER_AUTH_SECRET, {
      callId: call._id,
      userId: call.calleeId,
      expiresAt: new Date(call.ringDeadline.getTime() + CALL_TOKEN_GRACE_SECONDS * 1000),
    }),
  }

  const sends: Promise<unknown>[] = []

  for (const target of targets.voip) {
    sends.push(
      app.voip
        .send({
          token: target.token,
          environment: target.environment,
          // `aps` is empty on purpose: a VoIP push draws nothing by itself.
          // Everything the phone's own code needs is under our key.
          payload: { aps: {}, langx: data },
          expiresAt: call.ringDeadline,
        })
        .then((result) => (!result.ok && result.gone ? dropVoipToken(db, target.token) : null)),
    )
  }

  if (targets.android.length > 0) {
    sends.push(
      sendCallSignalPush(db, app.push, { to: targets.android, data, ttlSeconds: ringSeconds }),
    )
  }

  // One request per language, like every other push: a phone and a tablet in
  // the same language are one send.
  const byLocale = new Map<Locale, string[]>()
  for (const { token, locale } of targets.fallback) {
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), token])
  }
  for (const [locale, tokens] of byLocale) {
    const t = translator(locale)
    sends.push(
      sendPush(db, app.push, {
        to: tokens,
        title: caller.displayName,
        body: t(call.media === 'video' ? 'push.callIncomingVideo' : 'push.callIncomingVoice'),
        data: { kind: 'call', conversationId: data.conversationId, senderId: caller._id },
        ttlSeconds: ringSeconds,
        priority: 'high',
      }),
    )
  }

  const results = await Promise.allSettled(sends)
  for (const result of results) {
    if (result.status === 'rejected') {
      app.log.warn({ err: result.reason as unknown, callId: call._id }, 'ringing a phone failed')
    }
  }
}

/**
 * Tells the phones that were ringing to stop.
 *
 * Android only. An iPhone cannot be told this way — see `voipPush.ts` for why
 * no VoIP push may ever mean "never mind" — and stops by its own ring timer,
 * or sooner when its app wakes and asks. The fallback notification simply
 * stays in the shade; tapping it opens a thread whose last row says what
 * happened.
 */
export async function stopRinging(
  app: FastifyInstance,
  call: Call,
  reason: CallEndReason,
  exceptDeviceId?: string,
): Promise<void> {
  try {
    const targets = await loadRingTargets(app, call.calleeId, exceptDeviceId)
    await sendCallSignalPush(app.mongo.db, app.push, {
      to: targets.android,
      data: { kind: CALL_CANCEL_KIND, callId: call._id, reason },
      // Longer than a ring: a phone that got the ring late must still get this.
      ttlSeconds: 60,
    })
  } catch (error) {
    app.log.warn({ err: error, callId: call._id }, 'stopping a ring failed')
  }
}
