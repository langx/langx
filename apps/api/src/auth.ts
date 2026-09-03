import { APP_SCHEMES, IOS_BUNDLE_ID, PASSWORD_MIN_LENGTH, WEB_HOST, webUrl } from '@langx/shared'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { expo } from '@better-auth/expo'
import { anonymous } from 'better-auth/plugins/anonymous'
import { deviceAuthorization } from 'better-auth/plugins/device-authorization'
import type { Db, MongoClient } from 'mongodb'
import { generateAppleClientSecret } from './auth/appleClientSecret'
import { settlePrecreatedUser } from './modules/handles/legacyPrecreate'
import { restoreLegacyProfile } from './modules/handles/legacyRestore'
import { recordTermsAcceptance } from './modules/account/terms'
import type { EmailSender } from './email/sender'
import { existingAccountEmail, resetPasswordEmail, verificationEmail } from './email/templates'
import { localeFromHeader } from './i18n'
import { publicApiUrl, type Env } from './env'
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
  const baseURL = publicApiUrl(env)

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
      // The same number the sign-up form checks against, from the same
      // constant. Better Auth's own default is 8; leaving it would mean a form
      // that accepts a six-character password and a server that answers with
      // an error the field cannot explain. Its 128-character ceiling is left
      // alone: that is a guard against a megabyte reaching the hash, not a
      // rule anybody is meant to read.
      minPasswordLength: PASSWORD_MIN_LENGTH,
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
      /**
       * A sign-up for an address that already has an account is answered with
       * the same "check your email" as a fresh one — Better Auth's
       * anti-enumeration answer, in force here because email verification is
       * required — and then nothing arrives. This is the hook meant for that
       * gap: tell them, over the one channel that leaks nothing, that the
       * account exists and how to get into it. Written for the v1 rows
       * `legacyPrecreate.ts` opens, whose owners will mostly try signing up
       * first; right for anyone else who forgot they had an account, too.
       */
      onExistingUserSignUp: async ({ user }, request) => {
        const email = existingAccountEmail(
          webUrl('/forgot-password'),
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
            /**
             * Stamped here rather than taken from the sign-up body, because a
             * client that skipped the tickbox could otherwise assert it. Every
             * route into an account passes through this hook — email/password,
             * Google, Apple and the legacy bridge — so there is no way to hold
             * an account without a record of the terms in force when it was
             * made.
             *
             * The version, not just a date: a date only answers "when", and
             * the question that gets asked is "which text did they agree to".
             */
            await recordTermsAcceptance(db, user.id)

            if (!user.emailVerified) return
            await tryRestore(user.id, user.email)
          },
        },
      },
      session: {
        create: {
          /**
           * The one route the hook above cannot see: a `user` row the
           * pre-creation script wrote for a v1 account, which its owner then
           * claims with a password reset or a Google/Apple link — neither of
           * which creates a user. The first session is where that account
           * gets the terms stamp and the restore every other route already
           * had. See `legacyPrecreate.ts`; a no-op for everyone else.
           */
          after: async (session) => {
            try {
              await settlePrecreatedUser(db, session.userId, tryRestore)
            } catch (error) {
              console.error('[legacy-precreate] settle failed', { userId: session.userId, error })
            }
          },
        },
      },
    },

    socialProviders,

    plugins: [
      expo(),
      /*
       * A session for somebody who has not signed up yet, so the app can show
       * them real people before asking for an email.
       *
       * Only half of this plugin is used. Its *linking* half is switched off by
       * never being reached: `emailAndPassword` here has
       * `requireEmailVerification: true` and `autoSignIn: false`, so
       * `signUp.email` returns no session at all, and `onLinkAccount` would fire
       * around a `newUser` that has none. The client signs the guest out and
       * registers fresh instead — which loses nothing, because a guest cannot
       * write and therefore owns no rows to carry over. The language choices
       * travel in the device-side onboarding draft, which already survives a
       * relaunch and is cleared only on a real submit.
       *
       * `.invalid` is reserved by RFC 2606 and can never resolve, so the
       * synthetic addresses this mints cannot receive mail even by accident.
       */
      anonymous({ emailDomainName: 'guest.langx.invalid' }),
      /*
       * QR sign-in on the web, which is RFC 8628's device flow with a picture
       * in front of it: the browser asks for a code, shows it as a QR *and* as
       * six characters, and polls `/device/token` until a signed-in phone
       * approves it.
       *
       * The plugin rather than something hand-rolled — this is a protocol with
       * known failure modes (`slow_down`, `authorization_pending`, single-use
       * codes, expiry) and it already implements them.
       *
       * Scanning is **not** what makes it work. The six-character user code is
       * the primary path and the QR is a shortcut, which is deliberate:
       * `expo-camera` is not in this app, and adding it means a new native
       * build with a new camera permission — so a scanner cannot ship over the
       * air. Typing the code works today on every platform.
       */
      deviceAuthorization({
        /*
         * Two minutes. Long enough to pick up a phone and read six characters,
         * short enough that a code photographed off somebody's screen is
         * worthless by the time they have walked away.
         */
        expiresIn: '2m',
        /** What the poller is told to wait between attempts. */
        interval: '5s',
        /** Where the phone is sent; shown under the code for hand entry. */
        verificationUri: `https://${WEB_HOST}/link-device`,
      }),
    ],
  })
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
