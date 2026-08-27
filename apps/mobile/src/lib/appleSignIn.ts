import { Platform } from 'react-native'

/**
 * What Better Auth needs to turn an Apple sign-in into a session, in the shape
 * its `signIn.social({ idToken })` parameter expects.
 */
export interface AppleIdentity {
  token: string
  nonce?: string
  user?: {
    name?: { firstName?: string; lastName?: string }
    email?: string
  }
}

/**
 * Sign in with Apple, natively.
 *
 * The web redirect flow works on iOS too, so this exists for two reasons that
 * are not convenience:
 *
 *  1. **Review.** Offering Google sign-in and sending iOS users through a web
 *     view for Apple is the standard 4.8 rejection. The native sheet is what
 *     Apple means by "Sign in with Apple".
 *  2. **Identity.** The native sheet returns an identity token signed for the
 *     *bundle identifier*, while the web flow returns one signed for the
 *     Services ID. They are different audiences, so without
 *     `appBundleIdentifier` on the server (see apps/api/src/auth.ts) the same
 *     person signing in the two ways ends up as two accounts.
 *
 * Everything below imports `expo-apple-authentication` lazily, for the reason
 * documented in docs/decisions.md: a native module resolved at module scope
 * takes the whole bundle down on the platforms that do not have it, and this
 * one exists on exactly one of the three.
 */
export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  try {
    const AppleAuthentication = await import('expo-apple-authentication')
    // False on an iPad running an old iOS, and in some simulators — which is
    // why this is asked rather than assumed from `Platform.OS`.
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

/**
 * `null` means the person closed the sheet, which is not an error and must not
 * produce a message. Anything genuinely wrong throws.
 */
export async function requestAppleIdentity(): Promise<AppleIdentity | null> {
  const AppleAuthentication = await import('expo-apple-authentication')

  let credential: Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null
    throw error
  }

  if (!credential.identityToken) {
    // Documented as possible and, in practice, always a configuration fault:
    // the Sign in with Apple capability missing from the build.
    throw new Error('Apple returned no identity token')
  }

  /**
   * Apple sends the name and email **only on the very first authorization for
   * this app**, and never again — not even after deleting and reinstalling.
   * The token itself always carries the email, so the account is never
   * anonymous, but the name is gone for good if it is dropped here. Hence
   * passing it through rather than reading it back from the token later.
   */
  const { givenName, familyName } = credential.fullName ?? {}
  const name =
    givenName || familyName
      ? {
          ...(givenName ? { firstName: givenName } : {}),
          ...(familyName ? { lastName: familyName } : {}),
        }
      : undefined

  const user =
    name || credential.email
      ? { ...(name ? { name } : {}), ...(credential.email ? { email: credential.email } : {}) }
      : undefined

  return {
    token: credential.identityToken,
    ...(user ? { user } : {}),
  }
}
