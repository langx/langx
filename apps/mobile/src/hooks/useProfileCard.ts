import { useMe } from '../api/queries'
import type { ShareCardRequest } from '../components/ShareCardSheet'
import { useDisplayNames, useLocale, useT } from '../i18n'
import type { ShareContent } from '../lib/shareText'

/**
 * The share card for your own profile — from Share profile, and from Invite.
 *
 * Both used to send a sentence and a link; a picture of the person with a
 * code a second phone can scan is what that link was trying to be. The two
 * differ only in the pill (`share.cardProfileHeadline`, or the invite's) and
 * in the sentence that goes out when the picture cannot be made, which each
 * screen already had and passes in.
 *
 * Only the words travel. Whose card it is, their name, face and colour are
 * read on the server from the account that asks — the card cannot be of
 * anybody else — and nothing else goes on it: no age, no city.
 *
 * `null` until the profile has arrived, when there is nothing to draw yet;
 * the caller shares the sentence instead.
 */
export function useProfileCard(): (
  pill: 'profile' | 'invite',
  fallback: ShareContent,
) => ShareCardRequest | null {
  const me = useMe()
  const names = useDisplayNames()
  const { locale } = useLocale()
  const t = useT()
  return (pill, fallback) => {
    const profile = me.data
    if (!profile) return null
    // Your first native language and your top learning one, as the recap card
    // words them: the line that says what a stranger would practise with you.
    const native = profile.nativeLanguages[0]?.code
    const learning = [...profile.learning].sort((a, b) => a.priority - b.priority)[0]?.code
    const languages =
      native && learning
        ? t('recap.card.languages', {
            native: names.language(native),
            learning: names.language(learning),
          })
        : undefined
    return {
      kind: 'profile',
      headline: t(pill === 'invite' ? 'share.cardInviteHeadline' : 'share.cardProfileHeadline'),
      caption: t('share.cardProfileCaption'),
      fallback,
      profile: { locale, ...(languages ? { languages } : {}) },
    }
  }
}
