import {
  COMPANION_SNAPSHOT_VERSION,
  type CompanionSnapshot,
  type EchoSummary,
  type Locale,
} from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'

/**
 * What the app already holds, in the shape the four queries hand it over.
 *
 * Deliberately the *responses*, not a flattened set of numbers: the call site
 * then passes what it has without restating any of it, and the compiler is the
 * thing that notices when one of those endpoints changes underneath us.
 */
export interface CompanionSources {
  /** `GET /me/unread`. */
  unread: number
  /**
   * `GET /profiles/me`. All three streak numbers come from the one response —
   * `/me/activity` carries the same day but asks for a date range the widget
   * has no use for, and the profile is already in the cache on every screen.
   */
  profile: { streak: { current: number; longest: number; lastQualifiedDay: string | null } }
  /** `GET /echo/summary`. */
  echo: Pick<EchoSummary, 'due' | 'nextDue'>
}

/**
 * Assemble the blob the iOS widgets read. Pure: the caller writes it.
 *
 * The labels are looked up here rather than on the Swift side because the app
 * is where the eight catalogues already are — see the note on
 * `companionSnapshotSchema`. They are the same three strings the app's own
 * tiles use, so a rewording reaches the Home Screen without a second edit:
 * `me.dayStreak`, `inbox.unread`, `echo.tileDue`.
 *
 * `lastQualifiedDay` is copied across untouched. Deciding here whether today
 * has counted would freeze the answer at the moment of writing, and the
 * question is asked again every time the widget's timeline wakes — including
 * after a midnight the app slept through.
 */
export function buildCompanionSnapshot(
  sources: CompanionSources,
  locale: Locale,
  t: TranslateFn,
  now: Date = new Date(),
): CompanionSnapshot {
  return {
    version: COMPANION_SNAPSHOT_VERSION,
    writtenAt: now.toISOString(),
    locale,
    unread: sources.unread,
    streak: {
      current: sources.profile.streak.current,
      longest: sources.profile.streak.longest,
      lastQualifiedDay: sources.profile.streak.lastQualifiedDay,
    },
    echo: {
      due: sources.echo.due,
      /**
       * `nextDue` is optional on the summary — an app talking to an older API
       * simply does not get one — and the snapshot's field is not. Null is the
       * same answer the widget draws for "nothing waiting", so the absence
       * collapses into it rather than becoming a second empty state.
       */
      nextDue: sources.echo.nextDue ?? null,
    },
    labels: {
      streak: t('me.dayStreak'),
      unread: t('inbox.unread'),
      cardsDue: t('echo.tileDue'),
    },
  }
}
