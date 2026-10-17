import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import { BUTTON_FACE, Button } from '../ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

const S = ADMIN.gallery.buttons

/**
 * Every variant, size and state of `Button`, then `IconButton` and the bare
 * `PressableScale`, on v3's ground. Labels are real catalogue copy, so a
 * German or Russian label shows where it wraps; the notes round them are the
 * gallery's own English.
 */
function ButtonsBody() {
  const t = useT()
  const styles = useStyles()
  const noop = (): void => undefined

  return (
    <>
      <V3Plate>
        <Text style={styles.heading}>{S.variants}</Text>
        <Sample note={S.spec('primary', BUTTON_FACE.default)}>
          <RunDemo label={t('common.save')} doneLabel={t('photo.saved')} />
        </Sample>
        <Sample note={S.spec('blue')}>
          <Button variant="blue" icon="user-plus" label={t('me.invite')} onPress={noop} />
        </Sample>
        <Sample note={S.spec('secondary')}>
          <Button variant="secondary" label={t('welcome.createAccount')} onPress={noop} />
        </Sample>
        <Sample note={S.spec('ink')}>
          <Button variant="ink" icon="copy" label={t('messageActions.copy')} onPress={noop} />
        </Sample>
        <Sample note={S.spec('danger')}>
          <Button variant="danger" label={t('settings.signOut')} onPress={noop} />
        </Sample>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.sizes}</Text>
        <Sample note={S.spec('default', BUTTON_FACE.default)}>
          <Button
            variant="secondary"
            icon="share"
            label={t('messageActions.share')}
            onPress={noop}
          />
        </Sample>
        <Sample note={S.spec('medium', BUTTON_FACE.medium)}>
          <Button
            variant="secondary"
            size="medium"
            icon="mail"
            label={t('auth.continueWithGoogle')}
            onPress={noop}
          />
        </Sample>
        <Sample note={S.spec('small', BUTTON_FACE.small)}>
          <View style={styles.row}>
            <Button
              variant="ink"
              size="small"
              label={t('common.save')}
              onPress={noop}
              style={styles.auto}
            />
            <Button
              variant="secondary"
              size="small"
              label={t('common.cancel')}
              onPress={noop}
              style={styles.auto}
            />
            <Button
              variant="danger"
              size="small"
              label={t('common.remove')}
              onPress={noop}
              style={styles.auto}
            />
          </View>
        </Sample>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.states}</Text>
        <Sample note={S.loading}>
          <Button loading label={t('feed.sendCorrection')} onPress={noop} />
        </Sample>
        <Sample note={S.success}>
          <Button variant="ink" success icon="copy" label={t('chat.copied')} onPress={noop} />
        </Sample>
        <Sample note={S.disabled}>
          <Button disabled label={t('common.continue')} onPress={noop} />
        </Sample>
        <Sample note={S.iconEnd}>
          <Button
            variant="blue"
            icon="arrow-right"
            iconPosition="end"
            label={t('common.continue')}
            onPress={noop}
          />
        </Sample>
        <Sample note={S.wraps}>
          <View style={styles.narrow}>
            <Button variant="secondary" label={t('auth.continueWithGoogle')} onPress={noop} />
          </View>
        </Sample>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.iconButtons}</Text>
        <View style={styles.row}>
          <IconButton icon="arrow-left" accessibilityLabel={t('common.backPlain')} onPress={noop} />
          <IconButton
            icon="search"
            look="surface"
            accessibilityLabel={t('discover.searchHandles')}
            onPress={noop}
          />
          <IconButton icon="bell" look="ink" accessibilityLabel={t('inbox.bell')} onPress={noop}>
            <View style={styles.badge} />
          </IconButton>
          <IconButton icon="x" disabled accessibilityLabel={t('common.cancel')} onPress={noop} />
        </View>
        <Text style={styles.note}>
          {S.spec('plain · surface · ink · disabled', ICON_BUTTON_TARGET)}
        </Text>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.pressable}</Text>
        <PressableScale accessibilityRole="button" style={styles.tile} onPress={noop}>
          <Text style={styles.tileText}>{t('me.invite')}</Text>
        </PressableScale>
        <Text style={styles.note}>{S.pressableHint}</Text>
      </V3Plate>
    </>
  )
}

function Sample({ note, children }: { note: string; children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.sample}>
      {children}
      <Text style={styles.note}>{note}</Text>
    </View>
  )
}

/** The primary, live: a tap runs loading for a moment, then success, then back. */
function RunDemo({ label, doneLabel }: { label: string; doneLabel: string }) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const run = (): void => {
    setPhase('loading')
    timer.current = setTimeout(() => {
      setPhase('done')
      timer.current = setTimeout(() => setPhase('idle'), 1500)
    }, 1200)
  }
  return (
    <Button
      icon="corner-up-left"
      haptic="success"
      loading={phase === 'loading'}
      success={phase === 'done'}
      label={phase === 'done' ? doneLabel : label}
      onPress={run}
    />
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  heading: { ...v3.type.label, color: v3.colors.fg },
  sample: { gap: v3.space[4] },
  note: { ...v3.type.caption, color: v3.colors.muted },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  auto: { width: 'auto' },
  // About half a 390pt phone's column: where a two-up pair of buttons sits.
  narrow: { width: 170 },
  badge: {
    backgroundColor: v3.colors.yellow,
    borderColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    end: 8,
    top: 8,
    width: 12,
  },
  tile: {
    backgroundColor: v3.hues.lilac,
    borderRadius: v3.radius.tile,
    justifyContent: 'flex-end',
    minHeight: 96,
    padding: v3.space[16],
  },
  tileText: { ...v3.type.headline, color: v3.colors.ink },
}))

export const buttonsSection: GallerySectionEntry = {
  key: 'buttons',
  title: S.title,
  hint: S.hint,
  Body: ButtonsBody,
}
