import {
  APP_SCHEMES,
  IOS_BUNDLE_ID,
  magicLinkUrl,
  PASSWORD_MIN_LENGTH,
  WEB_HOST,
  webUrl,
} from '@langx/shared'
import { betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { expo } from '@better-auth/expo'
import { anonymous } from 'better-auth/plugins/anonymous'
import { deviceAuthorization } from 'better-auth/plugins/device-authorization'
import { magicLink } from 'better-auth/plugins/magic-link'
import type { Db, MongoClient } from 'mongodb'
import { generateAppleClientSecret } from './auth/appleClientSecret'
import {
  emailForHandle,
  looksLikeHandle,
  UNRESOLVED_HANDLE_EMAIL,
} from './modules/account/handleSignIn'
import { settlePrecreatedUser } from './modules/handles/legacyPrecreate'
import { restoreLegacyProfile } from './modules/handles/legacyRestore'
import { recordTermsAcceptance } from './modules/account/terms'
import type { EmailSender } from './email/sender'
import {
  existingAccountEmail,
  magicLinkEmail,
  resetPasswordEmail,
  verificationEmail,
} from './email/templates'
import { localeFromHeader } from './i18n'
import { publicApiUrl, type Env } from './env'
import type { RevenueCatClient } from './modules/billing/revenueCatClient'

/**
 * Where Apple POSTs the credential back from. Fixed by Apple, not by us or by
 * a deployment — see the `trustedOrigins` note in `createAuth`.
 */
const APPLE_ORIGIN = 'https://appleid.apple.com'

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
    //
    // `APPLE_ORIGIN` is there for a different reason, and it is not optional:
    // Sign in with Apple asks for `response_mode=form_post`, so Apple returns
    // the credential by POSTing to `/api/auth/callback/apple` from its own
    // servers, carrying `Origin: https://appleid.apple.com`. Every other
    // provider redirects the browser back with a GET and no cross-site origin,
    // which is why Apple is the only one that needs naming here. Without it
    // the callback is refused with INVALID_ORIGIN and the sign-in dies at the
    // last step, after the person has already authenticated with Apple.
    //
    // In code rather than TRUSTED_ORIGINS because it is Apple's fixed address,
    // identical for every deployment including self-hosted ones — the same
    // reasoning as the app schemes above.
    trustedOrigins: [
      ...env.TRUSTED_ORIGINS,
      ...APP_SCHEMES.map((scheme) => `${scheme}://`),
      APPLE_ORIGIN,
    ],

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

    session: {
      /*
       * `/list-sessions` sits behind Better Auth's freshness check, whose
       * default is 24 hours. A phone that signed in last week is exactly the
       * device somebody wants to see their sessions on, and it was answered
       * with 403 SESSION_NOT_FRESH — the list could not even be read, let
       * alone acted on.
       *
       * Zero turns the check off for that endpoint. It does not weaken
       * revocation: `/revoke-session` and `/revoke-other-sessions` use the
       * authoritative-session check, not the freshness one, and they are
       * unchanged. The only other fresh-gated endpoint is `/unlink-account`,
       * which this app never calls.
       */
      freshAge: 0,
    },

    hooks: {
      /**
       * Let people sign in with their handle as well as their address.
       *
       * The handle is the name the app shows them everywhere — `@sofia` on
       * their own profile — and it is the one they remember. The address is
       * often a provider's: somebody who arrived through Google or Apple may
       * never have typed theirs here at all.
       *
       * Done as a rewrite of `/sign-in/email` rather than as a second endpoint
       * because everything downstream then stays untouched — the same rate
       * limit, the same cookie, the same Expo client storing the same session.
       * A parallel route would have had to reproduce all of it, and Better
       * Auth types this field as a plain `z.string()`, so a handle reaches the
       * hook instead of being refused by validation first.
       *
       * A handle that matches nothing is replaced with an address that cannot
       * exist rather than left alone — see `UNRESOLVED_HANDLE_EMAIL`. Left
       * alone it would fail Better Auth's own address check with a 400 while a
       * real handle with a wrong password fails with a 401, and that
       * difference answers "does this handle have an account" for a name
       * anybody can read off a profile page.
       */
      before: createAuthMiddleware(async (ctx) => {
        // The emailed link accepts a handle for the same reason, and the
        // rewrite runs before the endpoint's own `z.email()` check does.
        if (ctx.path !== '/sign-in/email' && ctx.path !== '/sign-in/magic-link') return
        // Better Auth types this body as `any` at the hook boundary — it is
        // whatever the matched endpoint declares — so narrow before touching it.
        const body: unknown = ctx.body
        if (typeof body !== 'object' || body === null) return
        const typed: unknown = (body as { email?: unknown }).email
        if (typeof typed !== 'string' || !looksLikeHandle(typed)) return

        const email = (await emailForHandle(db, typed)) ?? UNRESOLVED_HANDLE_EMAIL
        return { context: { body: { ...body, email } } }
      }),

      /**
       * Give the browser a session cookie when the device grant hands out a
       * session.
       *
       * `/device/token` is an OAuth endpoint, so it answers with a bearer
       * token and nothing else — correct for the RFC, useless here. Nothing in
       * this app sends an `Authorization` header; every client is cookie-based,
       * so the browser polling for approval was handed a token it had no way
       * to use and stayed signed out with a 200 in its hand.
       *
       * The plugin has already created the real session and put it on the
       * context, so this only writes the cookie for it. Anything else that
       * creates a session sets its own.
       */
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/device/token') return
        const created = ctx.context.newSession
        if (created) await setSessionCookie(ctx, created)
      }),
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
       * five characters, and polls `/device/token` until a signed-in phone
       * approves it.
       *
       * The plugin rather than something hand-rolled — this is a protocol with
       * known failure modes (`slow_down`, `authorization_pending`, single-use
       * codes, expiry) and it already implements them.
       *
       * The typed code is the primary path and the QR is the shortcut. The
       * app has had a scanner since 5 September 2026 (`app/(app)/scan.tsx`,
       * `expo-camera`), but the phone's own camera app and a typed code both
       * still work, and typing is what a phone without the scanner build
       * falls back to.
       *
       * The QR encodes a `langx://` link rather than a web address: it is
       * scanned by the phone's own camera, and the phone is where the session
       * is — an https link opened a browser signed in as nobody.
       */
      deviceAuthorization({
        /*
         * Five characters, not the plugin's eight. Eight was never chosen; it
         * was the default, and it is a lot to read off one screen and type
         * on another. The arithmetic for five: a 32-symbol alphabet gives
         * 32⁵ ≈ 33.5 million codes; a code lives two minutes; and the plugin
         * limits `/device` to five requests per window — so a guess has about
         * one chance in 6.7 million per window, against a code that only ever
         * grants what the approving phone already has.
         */
        userCodeLength: 5,
        /*
         * Two minutes. Long enough to pick up a phone and read five
         * characters, short enough that a code photographed off somebody's
         * screen is worthless by the time they have walked away.
         */
        expiresIn: '2m',
        /*
         * What the poller is told to wait between attempts. Two seconds, not
         * the five it was: the browser only learns of an approval on its next
         * poll, so this number is the delay between the phone saying yes and
         * the laptop signing in. The traffic is one signed-out browser asking
         * one small question for at most two minutes.
         */
        interval: '2s',
        /** Where the phone is sent; shown under the code for hand entry. */
        verificationUri: `https://${WEB_HOST}/link-device`,
      }),
      /*
       * Sign in with an emailed link. The lighter door for the thousands of
       * v1 accounts that exist here as verified rows with no password: one
       * tap instead of a reset. See `docs/decisions.md` → _Sign in with an
       * emailed link_.
       *
       * The link in the mail is `magicLinkUrl(token)` — a page on the web
       * host, not the plugin's own `url`. The plugin's URL is a GET on this
       * API that spends the token, and two things follow a GET before a
       * human does: mail scanners, and the mail client's browser, which would
       * be the thing that ended up signed in rather than the app. Our page
       * does nothing on load; on a phone it is a universal link, so the app
       * opens and calls `/magic-link/verify` itself, and the session lands in
       * the app.
       *
       * `disableSignUp` is the load-bearing line. Left at its default the
       * endpoint creates an account for any address it is given, around the
       * terms tick-box and the age gate that sign-up has. Unknown addresses
       * get no mail and the same `{ status: true }` as everyone else —
       * Better Auth's own `requestPasswordReset` shape, so the endpoint
       * answers "is this address registered" to nobody.
       */
      magicLink({
        disableSignUp: true,
        /** Stored hashed, like a password: a copy of the database is not a stack of live links. */
        storeToken: 'hashed',
        /** A quarter of an hour: mail delay, a scanner or two, and a walk to the phone. Single-use anyway. */
        expiresIn: 15 * 60,
        sendMagicLink: async ({ email, token }, ctx) => {
          const user = await db
            .collection<{ email: string; isAnonymous?: boolean }>('user')
            .findOne(
              { email: email.trim().toLowerCase() },
              { projection: { email: 1, isAnonymous: 1 } },
            )
          // No account, or a guest's synthetic address that cannot receive
          // mail: send nothing, say nothing. The response is identical.
          if (!user || user.isAnonymous) return
          const locale = localeFromHeader(ctx?.request?.headers.get('accept-language') ?? undefined)
          await emailSender.send({ to: user.email, ...magicLinkEmail(magicLinkUrl(token), locale) })
        },
      }),
    ],
  })
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
