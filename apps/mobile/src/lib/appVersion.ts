import * as Application from 'expo-application'
import Constants from 'expo-constants'
import {
  APP_PLATFORM_AUTH_KEY,
  APP_PLATFORM_HEADER,
  APP_VERSION_AUTH_KEY,
  APP_VERSION_HEADER,
} from '@langx/shared'
import { Platform } from 'react-native'

/**
 * `nativeApplicationVersion` is what the installed binary carries, which is
 * the right answer on iOS and Android — but on the web there is no binary and
 * expo-application returns null, so the settings footer read `0.0.0` on
 * app.langx.io and every web request reported the same. The config version is
 * the `version` field of `app.config.ts`, which the binaries are built from
 * too, so the two only disagree when a store build is older than the web
 * deploy — and then the binary's own number is the one that matters.
 */
function knownVersion(): string | undefined {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? undefined
}

/** The version a person sees, e.g. in the settings footer. */
export function appVersion(): string {
  return knownVersion() ?? '0.0.0'
}

export function appPlatform(): string {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'
}

/**
 * Headers every request carries, so the server can decide `updateRequired`.
 *
 * An unknown version is left out rather than sent as `0.0.0`: the server
 * never forces an update on a missing header, but `0.0.0` parses fine and
 * sorts below every minimum, so the placeholder would have locked out a
 * client whose only fault was a bundle without a manifest.
 */
export function versionHeaders(): Record<string, string> {
  const version = knownVersion()
  return {
    ...(version ? { [APP_VERSION_HEADER]: version } : {}),
    [APP_PLATFORM_HEADER]: appPlatform(),
  }
}

/**
 * The socket's copy of `versionHeaders()`, as `auth` keys — nothing can set a
 * header on that transport (see `socket.ts`). An unknown version is left out
 * for the reason above, with one more here: `0.0.0` is a valid version to the
 * server, and it would have been counted as a build somebody is on.
 */
export function versionAuth(): Record<string, string> {
  const version = knownVersion()
  return {
    ...(version ? { [APP_VERSION_AUTH_KEY]: version } : {}),
    [APP_PLATFORM_AUTH_KEY]: appPlatform(),
  }
}
