import { APP_SCHEMES } from '@langx/shared'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { expo } from '@better-auth/expo'
import type { Db, MongoClient } from 'mongodb'
import { generateAppleClientSecret } from './auth/appleClientSecret'
import type { EmailSender } from './email/sender'
import { resetPasswordEmail, verificationEmail } from './email/templates'
import type { Env } from './env'

export interface CreateAuthOptions {
  env: Env
  db: Db
  client: MongoClient
  emailSender: EmailSender
}

/**
 * `betterAuth()` itself is synchronous, but wiring Apple requires signing a
 * JWT first (see auth/appleClientSecret.ts), so construction is async.
 */
export async function createAuth({ env, db, client, emailSender }: CreateAuthOptions) {
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
      appBundleIdentifier: 'tech.newchapter.languageXchange',
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
      sendResetPassword: async ({ user, url }) => {
        const email = resetPasswordEmail(url)
        await emailSender.send({ to: user.email, ...email })
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const email = verificationEmail(url)
        await emailSender.send({ to: user.email, ...email })
      },
    },

    socialProviders,

    plugins: [expo()],
  })
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
