/**
 * "Play again", for the take the card played last.
 *
 * A card can hold several takes — one or more people saying the sentence, and
 * under them the pack's synthesised readings — and each is its own button with
 * its own player, because which voice is speaking is the whole reason to keep
 * more than one. That is a good row to choose from and a bad row to repeat
 * from: hearing it again means finding the one just pressed among two or three
 * that look alike, told apart by a voice name most people do not read.
 *
 * So the repeat is one button of its own, under them, and it replays whichever
 * take was pressed last.
 *
 * **It calls that take's own play function rather than holding a player of its
 * own.** A second player pointed at the same URL would fetch the file twice
 * and could talk over the first; this way the button and the take's own button
 * are the same act. The function is simply remembered when the take is
 * pressed — no registry and no effects, so there is no cleanup order to get
 * wrong. Nothing has been pressed yet means no button, which is also what a
 * new card gets: `session.tsx` keys the provider by card.
 */
import Feather from '@expo/vector-icons/Feather'
import type { AudioPlayer } from 'expo-audio'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, Text } from 'react-native'
import { useT } from '../../i18n'
import { ensurePlaybackAudioMode } from '../../lib/audioSession'
import { makeStyles, useTheme } from '../../lib/theme'

interface Registry {
  /** Called by a take when somebody presses it. */
  played: (play: () => Promise<void>) => void
  /** The last take pressed, or nothing if none has been. */
  last: (() => Promise<void>) | undefined
}

const PlayAgainContext = createContext<Registry | null>(null)

export function PlayAgainProvider({ children }: { children: ReactNode }) {
  // Wrapped in an object: a bare function in `useState` would be taken for
  // the lazy initialiser and called instead of stored.
  const [last, setLast] = useState<{ play: () => Promise<void> } | null>(null)
  const played = useCallback((play: () => Promise<void>) => setLast({ play }), [])
  const value = useMemo<Registry>(() => ({ played, last: last?.play }), [played, last])
  return <PlayAgainContext.Provider value={value}>{children}</PlayAgainContext.Provider>
}

/**
 * A take's play function: starts it from the beginning, and offers itself as
 * the one to repeat.
 *
 * The four takes — a recording and a reading, on the session card and on the
 * card screen — had this written out four times. One of them is the definition
 * now.
 *
 * **Usable with no provider**, which is not a mistake to guard against: a take
 * drawn somewhere with no repeat button still has to play.
 */
export function useTakePlay(player: AudioPlayer): () => Promise<void> {
  const registry = useContext(PlayAgainContext)
  const played = registry?.played
  const start = useCallback(async () => {
    await ensurePlaybackAudioMode()
    /*
     * Awaited, so `play` cannot run before the position has moved. The press
     * this exists for is the one after the take has ended, where the player is
     * sitting at the end with nothing ahead of it — the case where a seek that
     * had not landed would be the difference between sound and silence.
     * `chat/[id].tsx` awaits it for the same reason.
     */
    await player.seekTo(0)
    player.play()
  }, [player])
  return useCallback(async () => {
    played?.(start)
    await start()
  }, [played, start])
}

/** The button. Absent until something has played, because until then it would do nothing. */
export function PlayAgainButton() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const last = useContext(PlayAgainContext)?.last
  if (!last) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.playAgain')}
      hitSlop={8}
      onPress={() => void last()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather name="rotate-ccw" size={16} color={colors.accent} />
      <Text style={styles.label}>{t('echo.playAgain')}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  label: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
