import { APP_SCHEMES, IOS_BUNDLE_ID, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@langx/shared'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { expo } from '@better-auth/expo'
import type { Db, MongoClient } from 'mongodb'
import { generateAppleClientSecret } from './auth/appleClientSecret'
import { restoreLegacyProfile } from './modules/handles/legacyRestore'
import type { EmailSender } from './email/sender'
import { resetPasswordEmail, verificationEmail } from './email/templates'
import { localeFromHeader } from './i18n'
import type { Env } from './env'
import type { RevenueCatClient } from './modules/billing/revenueCatClient'

export interface CreateAuthOptions {
  env: Env
  db: Db
  client: MongoClient
  emailSender: EmailSender
  /**
   * Only for the restore that fires on email verification, which hands the v1
   * loyalty gift out through RevenueCat. Optional so the many tests that build
   * an auth instance without a billing story keep working — leaving it out
   * simply means no gift is attempted.
   */
  revenueCat?: RevenueCatClient
}

/**
 * `betterAuth()` itself is synchronous, but wiring Apple requires signing a
 * JWT first (see auth/appleClientSecret.ts), so construction is async.
 */
export async function createAuth({ env, db, client, emailSender, revenueCat }: CreateAuthOptions) {
  const baseURL =
    env.BETTER_AUTH_URL ?? `http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`

  const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']> = {}

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    const appleClientSecret = await generateAppleClientSecret({
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      servicesId: env.APPLE_CLIENT_ID,
      privateKeyPem: env.APPLE_PRIVATE_KEY,
    })
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: appleClientSecret,
      // Lets native sign-in that returns Apple's identity token directly
      // (rather than the web redirect flow) resolve to the same account.
      appBundleIdentifier: IOS_BUNDLE_ID,
    }
  }

  /**
   * A restore must never be able to fail a sign-in. The account is real and
   * the session is valid either way; a failure here means the user lands
   * without their old profile, which onboarding can still recover, whereas a
   * thrown error means they cannot get in at all.
   */
  const tryRestore = async (userId: string, email: string): Promise<void> => {
    try {
      await restoreLegacyProfile(db, userId, email, env.LEGACY_EMAIL_HASH_SALT, revenueCat)
    } catch (error) {
      console.error('[legacy-restore] failed', { userId, error })
    }
  }

  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    // The Expo client sends its scheme as a request origin during the OAuth
    // redirect-proxy round trip; without it here that redirect is rejected.
    trustedOrigins: [...env.TRUSTED_ORIGINS, ...APP_SCHEMES.map((scheme) => `${scheme}://`)],

    database: mongodbAdapter(db, { client }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      // The same two numbers the sign-up form checks against, from the same
      // constant. Better Auth's own defaults are 8 and 128; leaving them would
      // mean a form that accepts a six-character password and a server that
      // answers with an error the field cannot explain.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      sendResetPassword: async ({ user, url }, request) => {
        // The language the *request* was made in. There is no stored
        // preference to read: a password reset is asked for from a signed-out
        // screen, and at sign-up the account is seconds old. The app sets this
        // header from whatever the reader picked, so it is a better answer
        // than anything on the account would be.
        const email = resetPasswordEmail(
          url,
          localeFromHeader(request?.headers.get('accept-language') ?? undefined),
        )
        await emailSender.send({ to: user.email, ...email })
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        const email = verificationEmail(
          url,
          localeFromHeader(request?.headers.get('accept-language') ?? undefined),
        )
        await emailSender.send({ to: user.email, ...email })
      },
      // Clicking the link is proof of the address, so a matching v1 profile
      // comes back here rather than waiting for the user to fill in a form
      // describing something we already have.
      afterEmailVerification: async (user) => {
        await tryRestore(user.id, user.email)
      },
    },

    databaseHooks: {
      user: {
        create: {
          /**
           * Covers the routes `afterEmailVerification` does not: Google and
           * Apple, where the provider has already proven the address and the
           * account is created verified, and the legacy-password bridge, which
           * creates the account itself.
           *
           * Fires for *every* new user, so the verified check is what keeps an
           * unverified email/password sign-up from restoring someone else's
           * profile by claiming their address.
           */
          after: async (user) => {
            if (!user.emailVerified) return
            await tryRestore(user.id, user.email)
          },
        },
      },
    },

    socialProviders,

    plugins: [expo()],
  })
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
