/**
 * Generated faces for accounts without a photo.
 *
 * The palette lives here rather than in the app's theme or the API's route
 * because both draw from it: the server renders the picture and the app draws
 * it, and a colour that drifted between them would be a face that changed
 * hue depending on who asked.
 */
export const GENERATED_AVATAR_BACKGROUNDS = ['3b6cf6', '009f70', 'f79009', 'ffc409'] as const

/** Every value a profile's `gender` can hold. */
export type AvatarGender = 'female' | 'male' | 'other' | 'undisclosed' | null

/**
 * Mild steering, and only one lever.
 *
 * Notionists' hair variants are unnamed (`variant01`…`variant63`), so there is
 * nothing to steer with there without hard-coding somebody's idea of which
 * number looks like which gender. The beard is the one option the style names
 * outright, so it is the only one taken.
 *
 * `other` and `undisclosed` get the untouched defaults on purpose: an account
 * that kept the field private must not be rendered as a third visible
 * category, which would disclose the very thing it declined to say.
 */
export function avatarOptionsFor(gender: AvatarGender): { beardProbability?: number } {
  if (gender === 'male') return { beardProbability: 60 }
  if (gender === 'female') return { beardProbability: 0 }
  return {}
}

/**
 * Where the app asks for one. Takes an account id, like the QR helpers take a
 * handle: the route generates from the id and nothing else, so a caller cannot
 * ask it to draw something it chose.
 */
export function generatedAvatarUrl(apiBaseUrl: string, seed: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/public/avatar/${encodeURIComponent(seed)}`
}
