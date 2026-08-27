import { Account, Client } from 'node-appwrite'
import type { Db } from 'mongodb'
import { hashLegacyEmail } from './legacyEmailHash'
import { findLegacyProfile } from './legacyProfiles'

/**
 * Verifies an email and password against the still-running v1 Appwrite.
 *
 * v1's password hashes are mathematically unusable here — one-way, and Better
 * Auth uses a different algorithm — so the only way to accept an old password
 * is to ask the system that can still check it. `createEmailPasswordSession`
 * is Appwrite's *public* sign-in endpoint: it needs the project id and no API
 * key, which is exactly the amount of trust this deserves.
 *
 * The session Appwrite hands back is discarded immediately. All we wanted was
 * the yes or no.
 */
export interface LegacyVerifier {
  verify(email: string, password: string): Promise<boolean>
}

export class AppwriteLegacyVerifier implements LegacyVerifier {
  readonly #endpoint: string
  readonly #projectId: string

  constructor(endpoint: string, projectId: string) {
    this.#endpoint = endpoint
    this.#projectId = projectId
  }

  async verify(email: string, password: string): Promise<boolean> {
    // A fresh client per attempt: the SDK's client carries session state, and
    // reusing one across users is how one person's attempt ends up
    // authenticated as another.
    const client = new Client().setEndpoint(this.#endpoint).setProject(this.#projectId)
    const account = new Account(client)
    try {
      const session = await account.createEmailPasswordSession({ email, password })
      // Best-effort cleanup; a stranded v1 session is harmless but untidy.
      try {
        client.setSession(session.secret)
        await new Account(client).deleteSession({ sessionId: 'current' })
      } catch {
        /* ignore */
      }
      return true
    } catch {
      return false
    }
  }
}

/** Used when APPWRITE_* is unset: the bridge simply never matches. */
export class DisabledLegacyVerifier implements LegacyVerifier {
  verify(): Promise<boolean> {
    return Promise.resolve(false)
  }
}

/**
 * The floor on how long the bridge takes to answer.
 *
 * Without it the endpoint is an email oracle. The *message* is identical
 * whether or not a v1 account exists, but the path is not: a match costs a
 * round trip to Appwrite and a miss returns immediately, so timing alone
 * separates "this address had a v1 account" from "it did not" — across 4787
 * addresses, that is the whole user list. Padding every answer to the same
 * floor removes the signal.
 */
export const MIN_RESPONSE_MS = 600

export async function padTo(startedAt: number, floorMs = MIN_RESPONSE_MS): Promise<void> {
  const remaining = floorMs - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

/**
 * Whether this address belongs to a v1 account we have staged.
 *
 * Checked before Appwrite is contacted at all, so the bridge only ever forwards
 * a password for an address we already know was a v1 user — a normal new
 * signup's password never leaves this system.
 */
export async function hasLegacyAccount(
  db: Db,
  email: string,
  salt: string | undefined,
): Promise<boolean> {
  if (!salt) return false
  return (await findLegacyProfile(db, hashLegacyEmail(email, salt))) !== null
}
