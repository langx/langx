import { View } from 'react-native'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The legal links, on their own screen.
 *
 * Five rows that every reader scrolls past to reach Community and Account. They
 * have to be reachable — two stores require it — but they do not have to be in
 * the way, and one row that says what is behind it is as findable as five.
 */
export default function LegalScreen() {
  useScreenInteractive()
  const t = useT()

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.legalSection')} onBack={() => goBackTo('/(app)/settings')} />
      <View>
        {LEGAL_LINKS.map((link, index) => (
          <ListRow
            key={link.url}
            title={t(link.labelKey as never)}
            onPress={() => void openExternal(link.url)}
            last={index === LEGAL_LINKS.length - 1}
          />
        ))}
      </View>
    </Screen>
  )
}
