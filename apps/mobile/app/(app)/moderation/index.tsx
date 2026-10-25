import { router } from 'expo-router'
import { Text } from 'react-native'
import { useModReports, type ModReportRowDto } from '../../../src/api/queries'
import { ModeratorGate } from '../../../src/components/ModeratorGate'
import {
  SettingsGroupV3,
  SettingsItemV3,
  SettingsScreenV3,
} from '../../../src/components/settings/v3/SettingsKitV3'
import { SettingsLeadV3 } from '../../../src/components/settings/v3/SettingsFormV3'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT, type TranslateFn } from '../../../src/i18n'
import { reportReasonLabel } from '../../../src/i18n/labels'
import { asReportReason } from '../../../src/lib/reportReason'
import { makeStyles } from '../../../src/lib/theme'

function aboutLabel(t: TranslateFn, row: ModReportRowDto): string {
  if (row.aboutPost) return t('moderation.aboutPost')
  if (row.aboutComment) return t('moderation.aboutComment')
  if (row.aboutTestimonial) return t('moderation.aboutReview')
  return t('moderation.aboutProfile')
}

/**
 * A moderator's queue: the open reports they may decide, newest first. The
 * server has already left out the ones that are not theirs — about another
 * moderator, an operator or themselves — and never says who filed any of them.
 */
export default function ModerationQueueScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const reports = useModReports()
  const items = reports.data?.items ?? []

  return (
    <ModeratorGate>
      <SettingsScreenV3 title={t('moderation.title')} back="/(app)/settings">
        <SettingsLeadV3>{t('moderation.lead')}</SettingsLeadV3>
        {reports.isPending ? (
          <Skeleton height={120} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>{t('moderation.empty')}</Text>
        ) : (
          <SettingsGroupV3>
            {items.map((row) => (
              <SettingsItemV3
                key={row.id}
                icon="flag"
                hue="tangerine"
                title={row.reported.handle ? `@${row.reported.handle}` : t('moderation.reported')}
                subtitle={`${reportReasonLabel(t, asReportReason(row.reason))} · ${aboutLabel(t, row)}`}
                tag={row.warned ? t('moderation.warnedTag') : null}
                onPress={() => router.push(`/(app)/moderation/${row.id}`)}
              />
            ))}
          </SettingsGroupV3>
        )}
      </SettingsScreenV3>
    </ModeratorGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  empty: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
