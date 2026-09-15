import Feather from '@expo/vector-icons/Feather'
import type { EchoVoice } from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { Pressable, Text } from 'react-native'
import { useT } from '../../i18n'
import { voiceLabel } from '../../i18n/labels'
import { ensurePlaybackAudioMode } from '../../lib/audioSession'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * A synthesised take, its own player. A `Recording`'s twin and deliberately
 * not the same thing: quieter, a chip for an icon, and labelled by register
 * and nothing else — there is nobody to credit. Shared by the session and the
 * card screen since a member can have their own card read.
 */
export function Reading({ take }: { take: EchoVoice }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const player = useAudioPlayer(take.url)

  async function play(): Promise<void> {
    await ensurePlaybackAudioMode()
    void player.seekTo(0)
    player.play()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={voiceLabel(t, take.voice)}
      hitSlop={8}
      onPress={() => void play()}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name="cpu" size={16} color={colors.textMuted} />
      <Text style={styles.label}>{voiceLabel(t, take.voice)}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  /* Quieter than a person's take, because it is the lesser of the two. */
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  pressed: { opacity: 0.6 },
}))
