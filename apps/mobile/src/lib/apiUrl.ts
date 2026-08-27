import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { resolveApiUrl } from './resolveApiUrl'

/**
 * The API's address for this build, resolved once.
 *
 * Split from `resolveApiUrl` only so the rule can be tested: this module
 * touches `expo-constants` and `react-native`, which the vitest setup
 * deliberately cannot load (see vitest.config.ts). The interesting part is
 * the pure function next door.
 */
export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
  __DEV__,
  Platform.OS === 'web',
)
