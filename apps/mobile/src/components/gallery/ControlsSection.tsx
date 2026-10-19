import { GENDERS, LANGUAGE_LEVELS, levelRank, type Gender } from '@langx/shared'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { genderShortLabel, useT } from '../../i18n'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import { ACTION_TOAST_DURATION_MS, showToast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Toggle } from '../ui/Toggle'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

const S = ADMIN.gallery.controls

/**
 * Kit, part two: `Toggle`, `SegmentedControl`, `ProgressBar` and the toast,
 * live. Every sample answers a tap, so the motion and the one haptic can be
 * judged here rather than hunted for across the settings and the filters.
 * Labels are real catalogue copy.
 */
function ControlsBody() {
  const t = useT()
  const styles = useStyles()

  return (
    <>
      <V3Plate>
        <Text style={styles.heading}>{S.toggles}</Text>
        <ToggleRow label={t('settings.pushThisDevice')} initial />
        <ToggleRow label={t('settings.hiddenMode')} initial={false} />
        <View style={styles.row}>
          <Toggle value accessibilityLabel={t('settings.hiddenMode')} busy onValueChange={noop} />
          <Toggle
            value={false}
            accessibilityLabel={t('settings.hiddenMode')}
            busy
            onValueChange={noop}
          />
          <Toggle
            value
            accessibilityLabel={t('settings.hiddenMode')}
            disabled
            onValueChange={noop}
          />
          <Toggle
            value={false}
            accessibilityLabel={t('settings.hiddenMode')}
            disabled
            onValueChange={noop}
          />
        </View>
        <Text style={styles.note}>{S.toggleStates}</Text>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.segmented}</Text>
        <Sample note={S.twoWay}>
          <TwoWay />
        </Sample>
        <Sample note={S.fourWay}>
          <FourWay />
        </Sample>
        <Sample note={S.band}>
          <Band />
        </Sample>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.progress}</Text>
        <Text style={styles.note}>{S.progressHint}</Text>
        <Stepper />
        <Text style={styles.note}>{S.steps}</Text>
      </V3Plate>

      <V3Plate>
        <Text style={styles.heading}>{S.toast}</Text>
        <Text style={styles.note}>{S.toastHint}</Text>
        <View style={styles.row}>
          <Button
            variant="secondary"
            size="small"
            label={S.raise}
            onPress={() => showToast(t('photo.saved'))}
            style={styles.auto}
          />
          <Button
            variant="secondary"
            size="small"
            label={S.raiseWithAction}
            onPress={() =>
              showToast(t('update.downloaded'), ACTION_TOAST_DURATION_MS, {
                label: t('update.restart'),
                onPress: noop,
              })
            }
            style={styles.auto}
          />
        </View>
      </V3Plate>
    </>
  )
}

function noop(): void {}

function ToggleRow({ label, initial }: { label: string; initial: boolean }) {
  const styles = useStyles()
  const [on, setOn] = useState(initial)
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Toggle value={on} onValueChange={setOn} accessibilityLabel={label} />
    </View>
  )
}

function TwoWay() {
  const t = useT()
  const [tab, setTab] = useState<'native' | 'learning'>('native')
  return (
    <SegmentedControl
      options={[
        { value: 'native', label: t('onboarding.native') },
        { value: 'learning', label: t('onboarding.learning') },
      ]}
      selected={[tab]}
      onToggle={setTab}
      accessibilityLabel={t('onboarding.languagesTitle')}
    />
  )
}

function FourWay() {
  const t = useT()
  const [gender, setGender] = useState<Gender>('undisclosed')
  return (
    <SegmentedControl<Gender>
      options={GENDERS.map((each) => ({
        value: each,
        label: each === 'undisclosed' ? t('onboarding.genderNotSaying') : genderShortLabel(t, each),
      }))}
      selected={[gender]}
      onToggle={setGender}
      accessibilityLabel={t('onboarding.gender')}
    />
  )
}

/** The filters' level band: tap one level for it alone, Any for all of them. */
function Band() {
  const t = useT()
  const [band, setBand] = useState<readonly string[]>(LANGUAGE_LEVELS.slice(1, 3))
  return (
    <SegmentedControl
      options={[
        { value: 'any', label: t('common.any') },
        ...LANGUAGE_LEVELS.map((level) => ({ value: level, label: String(levelRank(level)) })),
      ]}
      selected={band}
      onToggle={(value) => setBand(value === 'any' ? ['any'] : [value])}
      accessibilityLabel={t('filters.theirLevel')}
    />
  )
}

function Stepper() {
  const t = useT()
  const styles = useStyles()
  const [done, setDone] = useState(2)
  const total = 5
  const label = t('echo.sessionProgress', { done, total })
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={S.progressHint}
      onPress={() => setDone((at) => (at + 1) % (total + 1))}
      style={styles.stepper}
    >
      <ProgressBar value={done / total} height={8} accessibilityLabel={label} />
      <Text style={styles.note}>{label}</Text>
    </Pressable>
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

const useStyles = makeStyles(({ v3 }) => ({
  heading: { ...v3.type.label, color: v3.colors.fg },
  sample: { gap: v3.space[6] },
  note: { ...v3.type.caption, color: v3.colors.muted },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[16] },
  auto: { width: 'auto' },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12], minHeight: 44 },
  toggleLabel: { ...v3.type.body, color: v3.colors.fg, flex: 1 },
  stepper: { gap: v3.space[8], paddingVertical: v3.space[8] },
}))

export const controlsSection: GallerySectionEntry = {
  key: 'controls',
  title: S.title,
  hint: S.hint,
  Body: ControlsBody,
}
