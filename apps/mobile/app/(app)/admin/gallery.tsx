import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import { Redirect } from 'expo-router'
import { Text } from 'react-native'
import { AdminGate } from '../../../src/components/AdminGate'
import { GallerySection } from '../../../src/components/gallery/GallerySection'
import { GALLERY_SECTIONS } from '../../../src/components/gallery/sections'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { isDebugPanelEnabled } from '../../../src/lib/debugPanel'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The design gallery: every token the app draws with, the current look's
 * beside v3's, in whichever scheme the app is in.
 *
 * Behind two gates. The operator gate, like every screen here, and the debug
 * panel's, which needs a dev build with the flag set — so no shipped build
 * draws it, and the static web export's empty shell for this path is all a
 * stranger could ever reach.
 *
 * The sections are not written here. They are listed in
 * `src/components/gallery/sections.ts`, so the PR that adds a component adds
 * its section there and leaves this file alone.
 *
 * It loads Nunito Black for itself, since the root layout does not yet — see
 * `DISPLAY_FONT_BLACK`. Nothing waits on it: the screen draws at once and the
 * Display and Title samples take the face when it lands. Once a shipped
 * screen moves the font into the root, this load is a no-op and can go.
 */
export default function AdminGalleryScreen() {
  useScreenInteractive()
  useFonts({ Nunito_900Black })
  const styles = useStyles()

  if (!isDebugPanelEnabled()) return <Redirect href="/(app)/admin" />

  return (
    <AdminGate>
      <Screen scroll style={styles.column}>
        <ScreenHeader title={ADMIN.gallery.title} onBack={() => goBackTo('/(app)/admin')} />
        <Text style={styles.intro}>{ADMIN.gallery.intro}</Text>
        {GALLERY_SECTIONS.map(({ key, title, hint, Body }) => (
          <GallerySection key={key} title={title} hint={hint}>
            <Body />
          </GallerySection>
        ))}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  column: { paddingBottom: v3.space[32] },
  intro: { ...v3.type.callout, color: colors.textMuted, paddingBottom: v3.space[8] },
}))
