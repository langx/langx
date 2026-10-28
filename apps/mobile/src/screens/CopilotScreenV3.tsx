import type Feather from '@expo/vector-icons/Feather'
import {
  COPILOT_RULES,
  OFFICIAL_DISPLAY_NAMES,
  OFFICIAL_WRITABLE,
  officialAvatarUrl,
  type CopilotAction,
  type OfficialHandle,
} from '@langx/shared'
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useCopilotStatus } from '../api/copilot'
import { CopilotExample } from '../components/copilot/CopilotExample'
import { OfficialMark } from '../components/OfficialMark'
import { ExternalLinkCard } from '../components/product/ExternalLinkCard'
import { FeatureCard } from '../components/product/FeatureCard'
import { ProductFaq, type ProductQuestion } from '../components/product/ProductFaq'
import {
  BALANCED,
  ProductGroup,
  ROW_SQUARE,
  useGlyphScale,
  useStacked,
} from '../components/product/ProductGroup'
import { ProductHero } from '../components/product/ProductHero'
import { ProductScreen } from '../components/product/ProductScreen'
import { ProductSection } from '../components/product/ProductSection'
import { StepList } from '../components/product/StepList'
import { Avatar } from '../components/ui/Avatar'
import { useAppConfig } from '../hooks/useAppConfig'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useV3Home } from '../hooks/useV3Home'
import { useT } from '../i18n'
import { API_URL } from '../lib/apiUrl'
import { authClient } from '../lib/auth-client'
import { COPILOT_PAGE_HELPS, copilotAllowances, copilotPageAction } from '../lib/copilotPage'
import { COPILOT_SITE_URL } from '../lib/externalLinks'
import { shouldGateGuest } from '../lib/guestGate'
import { PRODUCT_TEXT_SCALE } from '../lib/productPage'
import { requireAccount } from '../lib/requireAccount'
import { makeStyles, useTheme } from '../lib/theme'

type Glyph = keyof typeof Feather.glyphMap

/** The official account the page describes (`officialAccounts.ts`). */
const ACCOUNT: OfficialHandle = 'copilot'

/**
 * Each help's glyph. Check and Say it wear the ones their rows have in the
 * thread's Copilot menu (`CopilotButton`), so the page and the menu match.
 */
const HELP_ICONS = {
  check: 'check-circle',
  sayIt: 'message-circle',
  explain: 'help-circle',
  replyIdeas: 'corner-up-left',
} as const satisfies Record<CopilotAction, Glyph>

/**
 * The Copilot page (plan #2067, items 0, 5 and 7): what Copilot is, its four
 * helps with a worked example each, when it helps, how to use it, what keeps
 * the person in charge, the @copilot account, questions, and its own site.
 *
 * Shown to everybody, Copilot on for them or not: the page describes it
 * either way, and only its one action changes (`copilotPageAction`). Copilot
 * is a beta on both plans, so the page sells nothing — the allowance line
 * says what Pro adds, which is more answers, never access.
 *
 * Every claim was checked against the code it describes; the numbers come
 * from `PLAN_LIMITS` and `COPILOT_RULES`, and the names of the buttons from
 * the keys the chat draws them with, so a renamed button renames itself here.
 */
export function CopilotScreenV3() {
  useScreenInteractive()
  const t = useT()
  const v3 = useV3Home()
  const service = useAppConfig().data?.copilotService
  const user = authClient.useSession().data?.user
  const session = !user ? 'none' : shouldGateGuest(user) ? 'guest' : 'member'
  // Asked only of a member where Copilot is on: for a guest `GET /copilot`
  // answers GUEST_ACCOUNT, and with the service off there is nothing to ask.
  const status = useCopilotStatus(v3 && session === 'member' && service === true)
  const action = copilotPageAction({ v3, session, service, status: status.data })
  const allowances = copilotAllowances()

  const names = {
    check: t('copilot.menuCheck'),
    sayIt: t('copilot.page.sayIt'),
    explain: t('copilot.explainAction'),
    replyIdeas: t('copilot.replyIdeas'),
  } satisfies Record<CopilotAction, string>

  const bodies = {
    check: t('copilot.page.checkBody'),
    sayIt: t('copilot.page.sayItBody', { count: COPILOT_RULES.sayItOptions }),
    explain: t('copilot.page.explainBody'),
    replyIdeas: t('copilot.page.replyIdeasBody', { count: COPILOT_RULES.replyIdeas }),
  } satisfies Record<CopilotAction, string>

  const when = [
    {
      key: 'check',
      title: t('copilot.page.whenCheck'),
      body: t('copilot.page.whenCheckBody', { check: names.check }),
    },
    {
      key: 'sayIt',
      title: t('copilot.page.whenSayIt'),
      body: t('copilot.page.whenSayItBody', { sayIt: names.sayIt }),
    },
    {
      key: 'explain',
      title: t('copilot.page.whenExplain'),
      body: t('copilot.page.whenExplainBody', { explain: names.explain }),
    },
    {
      key: 'replyIdeas',
      title: t('copilot.page.whenReplyIdeas'),
      body: t('copilot.page.whenReplyIdeasBody', { replyIdeas: names.replyIdeas }),
    },
  ] as const satisfies readonly { key: CopilotAction; title: string; body: string }[]

  const steps = [
    { key: 'open', title: t('copilot.page.step1'), body: t('copilot.page.step1Body') },
    { key: 'tap', title: t('copilot.page.step2'), body: t('copilot.page.step2Body', names) },
    { key: 'agree', title: t('copilot.page.step3'), body: t('copilot.page.step3Body') },
    { key: 'decide', title: t('copilot.page.step4'), body: t('copilot.page.step4Body') },
  ]

  const trust: readonly { key: string; icon: Glyph; title: string; body: string }[] = [
    {
      key: 'partner',
      icon: 'eye-off',
      title: t('copilot.page.trustPartner'),
      body: t('copilot.page.trustPartnerBody'),
    },
    {
      key: 'send',
      icon: 'send',
      title: t('copilot.page.trustSend'),
      body: t('copilot.page.trustSendBody', { useThis: t('copilot.useThis') }),
    },
    {
      key: 'off',
      icon: 'toggle-left',
      title: t('copilot.page.trustOff'),
      // The names the screens on the way carry, so the path is the one on screen.
      body: t('copilot.page.trustOffBody', {
        settings: t('settings.title'),
        privacy: t('settings.privacySection'),
        copilot: t('copilot.settingsTitle'),
      }),
    },
    {
      key: 'report',
      icon: 'flag',
      title: t('copilot.page.trustReport'),
      body: t('copilot.page.trustReportBody', { report: t('copilot.report') }),
    },
  ]

  const open = OFFICIAL_WRITABLE[ACCOUNT]
  const questions: ProductQuestion[] = [
    {
      key: 'person',
      question: t('copilot.page.faq.personQ'),
      answer: t('copilot.page.faq.personA'),
    },
    {
      key: 'wrong',
      question: t('copilot.page.faq.wrongQ'),
      answer: t('copilot.page.faq.wrongA', { report: t('copilot.report') }),
    },
    {
      key: 'partner',
      question: t('copilot.page.faq.partnerQ'),
      answer: t('copilot.page.faq.partnerA'),
    },
    ...(allowances
      ? [
          {
            key: 'allowance',
            question: t('copilot.page.faq.allowanceQ'),
            answer: t('copilot.page.faq.allowanceA', allowances),
          },
        ]
      : []),
    {
      key: 'sent',
      question: t('copilot.page.faq.sentQ'),
      // The consent sheet's own sentences, so the page cannot say less than
      // what a person agrees to.
      answer: [
        t('copilot.page.faq.sentA'),
        t('copilot.consentSends'),
        t('copilot.consentNever'),
      ].join(' '),
    },
    {
      key: 'languages',
      question: t('copilot.page.faq.languagesQ'),
      answer: t('copilot.page.faq.languagesA', { check: names.check, sayIt: names.sayIt }),
    },
    {
      key: 'hidden',
      question: t('copilot.page.faq.hiddenQ'),
      answer: t('copilot.page.faq.hiddenA'),
    },
    {
      key: 'account',
      question: t('copilot.page.faq.accountQ'),
      answer: t(open ? 'copilot.page.faq.accountOpenA' : 'copilot.page.faq.accountClosedA'),
    },
  ]

  return (
    <ProductScreen>
      <ProductHero
        key="hero"
        tone="blue"
        mark="copilot"
        title={t('copilot.label')}
        body={t('copilot.page.tagline')}
        {...(allowances ? { note: t('copilot.page.allowance', allowances) } : {})}
        {...(action === 'tryInChat'
          ? {
              action: {
                label: t('copilot.page.tryIt'),
                icon: 'message-circle' as const,
                // Copilot lives in a conversation, and the list of them is
                // where a person picks one; no chat is chosen for them.
                onPress: () => router.navigate('/(app)/(tabs)/chats'),
              },
            }
          : action === 'signUp'
            ? {
                // A guest's only way to Copilot, asked once, and here rather
                // than at the foot: it is in the first screen, under what
                // Copilot is and how many answers a day it gives, so a guest
                // who came for it need not read seven sections to find it;
                // and it stands where a member's "Try it in a chat" does and
                // where every product page keeps its one action, so the page
                // has one shape for both. A second copy at the foot read as
                // the same button twice (#2084); `copilotPage.test.ts` holds
                // the screen to one.
                action: {
                  label: t('copilot.page.signUp'),
                  icon: 'user-plus' as const,
                  onPress: () => void requireAccount(user, { action: 'other' }),
                },
              }
            : {})}
      />
      <ProductSection
        key="helps"
        title={t('copilot.page.helpsTitle')}
        intro={t('copilot.page.helpsIntro')}
      >
        <ProductGroup>
          {COPILOT_PAGE_HELPS.map((help) => (
            <FeatureCard
              key={help}
              tone="blue"
              icon={HELP_ICONS[help]}
              title={names[help]}
              body={bodies[help]}
            >
              <CopilotExample help={help} />
            </FeatureCard>
          ))}
        </ProductGroup>
      </ProductSection>
      <ProductSection key="when" title={t('copilot.page.whenTitle')}>
        <ProductGroup>
          {when.map((moment) => (
            <FeatureCard
              key={moment.key}
              tone="blue"
              icon={HELP_ICONS[moment.key]}
              title={moment.title}
              body={moment.body}
            />
          ))}
        </ProductGroup>
      </ProductSection>
      <ProductSection key="how" title={t('copilot.page.howTitle')}>
        <StepList tone="blue" steps={steps} />
      </ProductSection>
      <ProductSection key="trust" title={t('copilot.page.trustTitle')}>
        <ProductGroup>
          {trust.map((item) => (
            <FeatureCard
              key={item.key}
              tone="blue"
              icon={item.icon}
              title={item.title}
              body={item.body}
            />
          ))}
        </ProductGroup>
      </ProductSection>
      <ProductSection key="account" title={t('copilot.page.accountTitle')}>
        <AccountCard open={open} />
      </ProductSection>
      <ProductFaq key="faq" items={questions} />
      <ExternalLinkCard
        key="site"
        tone="blue"
        mark="copilot"
        title={t('copilot.page.siteTitle')}
        url={COPILOT_SITE_URL}
      />
    </ProductScreen>
  )
}

/**
 * @copilot as a profile row shows it: its face, its name with the official
 * tick, its handle, and what it is for. While the account takes no messages
 * (`OFFICIAL_WRITABLE`) a grey "Coming soon" stands beside the name, and the
 * line says Copilot works in a person's chats for now; the day the switch
 * flips, both change with it and nobody has to remember this page.
 *
 * Not a target: until it opens there is nowhere useful to go, and a profile
 * with no way to write is a dead end the line above already explains.
 */
function AccountCard({ open }: { open: boolean }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const glyph = useGlyphScale()
  const stacked = useStacked()
  const name = OFFICIAL_DISPLAY_NAMES[ACCOUNT]
  return (
    <ProductGroup>
      <View style={[styles.account, stacked && styles.accountStacked]}>
        <Avatar url={officialAvatarUrl(API_URL, ACCOUNT)} name={name} size={ROW_SQUARE * glyph} />
        <View style={styles.accountWords}>
          <View style={styles.nameLine}>
            <View style={styles.name}>
              <Text style={styles.nameText} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}>
                {name}
              </Text>
              <OfficialMark size={Math.round(v3.icon.xs * glyph)} />
            </View>
            {open ? null : (
              <View style={styles.soon}>
                <Text style={styles.soonText} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
                  {t('copilot.page.accountSoon')}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.handle} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
            @{ACCOUNT}
          </Text>
          <Text
            style={[styles.body, BALANCED]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {t(open ? 'copilot.page.accountOpen' : 'copilot.page.accountClosed')}
          </Text>
        </View>
      </View>
    </ProductGroup>
  )
}

// The row metrics are `ProductRow`'s, so the card lines up with the rows on
// the rest of the page and stacks at the same text size they do.
const useStyles = makeStyles(({ v3 }) => ({
  account: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  accountStacked: { flexDirection: 'column', gap: v3.space[6] },
  accountWords: { alignSelf: 'stretch', flex: 1, gap: v3.space[2], minWidth: 0 },
  // Wraps rather than squeezes: at the larger text sizes the badge drops
  // under the name instead of pushing it into two lines.
  nameLine: {
    alignItems: 'center',
    columnGap: v3.space[8],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: v3.space[4],
  },
  name: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  nameText: { ...v3.type.button, color: v3.colors.fg },
  soon: {
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  soonText: { ...v3.type.label, color: v3.colors.muted },
  // Only as wide as the handle and set at the layout's start: a Latin handle
  // takes its own left-to-right direction, so in Arabic a full-width line
  // would push it to the far left, away from the name above it.
  handle: { ...v3.type.caption, alignSelf: 'flex-start', color: v3.colors.muted },
  body: { ...v3.type.caption, color: v3.colors.muted },
}))
