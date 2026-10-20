import { sendAwardSchema, type SendAward } from '@langx/shared'

/** The code an ack timeout rejects with, so callers can word it as "not sent". */
export const ACK_TIMEOUT = 'ACK_TIMEOUT'

/** What the API answers a socket event with — see `sentAck` in the API's `ws/index.ts`. */
export interface AckResponse {
  ok: boolean
  data?: unknown
  award?: unknown
  error?: { code: string; message: string }
}

/** A successful ack, with what the send earned when the server said. */
export interface Acked<T> {
  data: T
  award?: SendAward
}

/**
 * Turns socket.io's ack callback arguments into a result or a thrown error
 * carrying `.code`, the API's error shape.
 *
 * Pure and apart from `socket.ts` so the tests can reach it: `socket.ts`
 * loads React Native, which the mobile vitest cannot.
 *
 * `award` is a sibling of `data` in the ack, never inside it (the server's
 * comment on `sentAck` says why), and until this function existed the client
 * read `data` alone — so the award the API has sent since it was added never
 * arrived anywhere. It is parsed with the shared schema rather than trusted:
 * a reward drawn from a malformed answer would claim tokens nobody was paid,
 * so anything that does not parse is treated as no award at all. A retry
 * answered from its `clientId` carries none either, because the first
 * attempt was the one paid.
 */
export function readAck<T>(timeout: Error | null, response: AckResponse | undefined): Acked<T> {
  if (timeout || !response) {
    throw Object.assign(new Error('ack timed out'), { code: ACK_TIMEOUT })
  }
  if (!response.ok) {
    throw Object.assign(new Error(response.error?.message ?? 'failed'), {
      code: response.error?.code,
    })
  }
  const award = response.award === undefined ? undefined : sendAwardSchema.safeParse(response.award)
  return award?.success
    ? { data: response.data as T, award: award.data }
    : { data: response.data as T }
}
