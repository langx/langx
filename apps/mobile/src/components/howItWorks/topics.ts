import type Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import type { ComponentProps } from 'react'
import type { MessageKey } from '../../i18n'
import { LEGAL_LINKS } from '../../lib/externalLinks'

/*
 * The topics "How LangX works" explains, shared by today's page and its v3
 * drawing (`HowItWorksScreenV3`) so the two cannot say different things.
 */

export interface Topic {
  id: string
  icon: ComponentProps<typeof Feather>['name']
  title: MessageKey
  /** Paragraphs above the list. */
  body: readonly MessageKey[]
  /** A ✓ for advice, a ✕ for a rule — the two lists read differently at a glance. */
  points?: { mark: 'check' | 'x'; keys: readonly MessageKey[] }
  /** Paragraphs under the list. */
  after?: readonly MessageKey[]
  /** A picture made of the app's own UI rather than a drawing of it. */
  demo?: 'menu' | 'plus' | 'correction'
}

export const ABOUT: readonly Topic[] = [
  {
    id: 'what',
    icon: 'info',
    title: 'howItWorks.whatTitle',
    body: ['howItWorks.whatBody', 'howItWorks.whatBody2'],
  },
  {
    id: 'help',
    icon: 'heart',
    title: 'howItWorks.helpTitle',
    body: ['howItWorks.helpBody'],
    points: {
      mark: 'check',
      keys: [
        'howItWorks.helpTakeTurns',
        'howItWorks.helpCorrect',
        'howItWorks.helpSimple',
        'howItWorks.helpQuestions',
        'howItWorks.helpPatient',
      ],
    },
  },
  {
    id: 'rules',
    icon: 'alert-triangle',
    title: 'howItWorks.rulesTitle',
    body: ['howItWorks.rulesLead'],
    /*
     * The community guidelines' own list, in the same order, shortened. Not
     * a second rulebook: a rule added here and not there would be one nobody
     * enforces. Politics and religion are said out loud because the apps
     * people arrive from ban them, and the guidelines here do not.
     */
    points: {
      mark: 'x',
      keys: [
        'howItWorks.rulesHarassment',
        'howItWorks.rulesHate',
        'howItWorks.rulesSexual',
        'howItWorks.rulesMinors',
        'howItWorks.rulesImpersonation',
        'howItWorks.rulesPrivate',
        'howItWorks.rulesSpam',
      ],
    },
    after: ['howItWorks.rulesTopics', 'howItWorks.rulesBlock'],
  },
]

export const FEATURES: readonly Topic[] = [
  {
    id: 'discover',
    icon: 'search',
    title: 'howItWorks.discoverTitle',
    body: ['howItWorks.discoverBody'],
  },
  {
    id: 'hold',
    icon: 'message-circle',
    title: 'howItWorks.holdTitle',
    body: ['howItWorks.holdBody'],
    demo: 'menu',
  },
  {
    id: 'correct',
    icon: 'edit-3',
    title: 'howItWorks.correctTitle',
    body: ['howItWorks.correctBody'],
    demo: 'correction',
  },
  {
    id: 'translate',
    icon: 'globe',
    title: 'howItWorks.translateTitle',
    body: ['howItWorks.translateBody'],
  },
  {
    id: 'sendTranslation',
    icon: 'send',
    title: 'howItWorks.sendTranslationTitle',
    body: ['howItWorks.sendTranslationBody'],
  },
  {
    id: 'plus',
    icon: 'plus-circle',
    title: 'howItWorks.plusTitle',
    body: ['howItWorks.plusBody'],
    demo: 'plus',
  },
  { id: 'voice', icon: 'mic', title: 'howItWorks.voiceTitle', body: ['howItWorks.voiceBody'] },
  { id: 'echo', icon: 'repeat', title: 'howItWorks.echoTitle', body: ['howItWorks.echoBody'] },
  { id: 'feed', icon: 'users', title: 'howItWorks.feedTitle', body: ['howItWorks.feedBody'] },
  { id: 'streak', icon: 'zap', title: 'howItWorks.streakTitle', body: ['howItWorks.streakBody'] },
]

// Found rather than copied, the way Our Kitchen finds its contributors page.
export const GUIDELINES_URL = LEGAL_LINKS.find((link) => link.labelKey === 'legal.community')?.url

/*
 * Handed to every paragraph; only "Write in their language" has a `{plan}`.
 * The plan's name from the shared table, like the Me tab's viewer row.
 */
export const PARAMS = { plan: TIER_NAMES.pro }

/**
 * The learning rows of the composer's + menu, in its order. Photos, voice and
 * stickers are left out as the parts nobody needs explained; the one that
 * needs a plan has its own topic.
 */
export const PLUS_ROWS = [
  { icon: 'edit-3', label: 'chat.askCorrection' },
  { icon: 'volume-2', label: 'chat.askPronunciation' },
  { icon: 'bookmark', label: 'chat.sendPhrase' },
  { icon: 'calendar', label: 'chat.sendMeeting' },
  { icon: 'help-circle', label: 'chat.sendQuiz' },
] as const satisfies readonly { icon: Topic['icon']; label: MessageKey }[]
