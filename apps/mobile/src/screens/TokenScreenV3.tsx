import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useLeaderboard, useTokens, useWallet } from '../api/queries'
import { ExternalLinkCard } from '../components/product/ExternalLinkCard'
import { FeatureCard } from '../components/product/FeatureCard'
import { ProductFaq } from '../components/product/ProductFaq'
import { ProductGroup, ProductRow } from '../components/product/ProductGroup'
import { ProductHero } from '../components/product/ProductHero'
import { ProductScreen } from '../components/product/ProductScreen'
import { ProductSection } from '../components/product/ProductSection'
import { StepList } from '../components/product/StepList'
import { useAppConfig } from '../hooks/useAppConfig'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useLocale, useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { openStickerPack } from '../lib/navigation'
import { requireAccount } from '../lib/requireAccount'
import {
  tokenGuestRow,
  tokenPageCopy,
  tokenYoursRows,
  VENUS_PACK_ID,
  type TokenPageRow,
  type TokenPageTarget,
} from '../lib/tokenPage'
import { openCollection } from './WalletStoreScreenV3'

/** The wallet's lime, which the spark already stands on (`components/product/tone.ts`). */
const TONE = 'lime'

/**
 * Each row's way in, to the place that holds the whole of it: the balance to
 * the wallet, a price to the store's own shelf, Venus's pack to its page.
 */
const GO: Record<TokenPageTarget, () => void> = {
  wallet: () => router.push('/(app)/wallet'),
  pool: () => router.push('/(app)/wallet/pool'),
  leaderboard: () => router.push('/(app)/wallet/leaderboard'),
  store: () => router.push('/(app)/wallet/store'),
  frames: () => openCollection('frame'),
  titles: () => openCollection('title'),
  stickers: () => openCollection('stickers'),
  venus: () => openStickerPack(VENUS_PACK_ID),
}

/**
 * LangX Token's page (plan #2067, §6 and §7): what the token is, how it is
 * earned and spent, and — in so many words — what it is not. It is the page
 * an App Review reader is sent to for guideline 3.1.5(b), so every line on it
 * comes from `lib/tokenPage.ts`, where a test holds it to
 * `docs/token-messaging-brief.md` in every language.
 *
 * Shown to everybody. Only the "Yours" block depends on who is reading: an
 * account's balance, today and place this week, each a way into the wallet;
 * for a guest, one line on what an account starts with.
 */
export function TokenScreenV3() {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestTokenPage /> : <MemberTokenPage />
}

function MemberTokenPage() {
  const t = useT()
  const { locale } = useLocale()
  const wallet = useWallet()
  const tokens = useTokens()
  // The week, as the wallet's board opens on it — and its cache, so going on
  // to the board shows the same place this row did.
  const board = useLeaderboard('week')
  const pull = usePullToRefresh(() =>
    Promise.all([wallet.refetch(), tokens.refetch(), board.refetch()]),
  )
  // Drawn at once, with each number arriving as its request does: the rows'
  // words do not depend on them, so a skeleton would hold back a block that
  // can already be read.
  const rows = tokenYoursRows(t, locale, {
    ...(wallet.data ? { balance: wallet.data.balance } : {}),
    ...(tokens.data ? { today: tokens.data.today } : {}),
    ...(board.data ? { rank: board.data.viewer.rank } : {}),
  })
  return (
    <TokenPage
      yours={<Rows rows={rows} />}
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    />
  )
}

/** A guest has no balance (rule 9): what an account starts with, and the way to one. */
function GuestTokenPage() {
  const t = useT()
  const { locale } = useLocale()
  const { data: session } = authClient.useSession()
  const row = tokenGuestRow(t, locale)
  return (
    <TokenPage
      yours={
        <ProductGroup>
          <FeatureCard
            tone={TONE}
            icon={row.icon}
            title={row.title}
            body={row.body}
            onPress={() => void requireAccount(session?.user, { action: 'other' })}
          />
        </ProductGroup>
      }
    />
  )
}

function TokenPage({
  yours,
  onRefresh,
  refreshing,
}: {
  yours: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
}) {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const stickerGifts = useAppConfig().data?.flags.stickerGifts === true
  const copy = tokenPageCopy(t, locale, { stickerGifts })

  return (
    <ProductScreen {...(onRefresh ? { onRefresh, refreshing: refreshing ?? false } : {})}>
      <ProductHero
        tone={TONE}
        mark="token"
        title={copy.hero.title}
        body={copy.hero.tagline}
        facts={copy.hero.facts}
      />
      <ProductSection title={t('tokens.page.yours')}>{yours}</ProductSection>
      <ProductSection title={copy.earn.title}>
        <Rows rows={copy.earn.rows} />
      </ProductSection>
      <ProductSection title={copy.pool.title} intro={copy.pool.intro}>
        <StepList tone={TONE} steps={copy.pool.steps} />
      </ProductSection>
      <ProductSection title={copy.spend.title}>
        <Rows rows={copy.spend.rows} />
      </ProductSection>
      <ProductSection title={copy.not.title}>
        <ProductGroup>
          {copy.not.rows.map((row) => (
            <ProductRow key={row.key} title={row.title} body={row.body} />
          ))}
        </ProductGroup>
      </ProductSection>
      <ProductFaq items={copy.faq} />
      <ExternalLinkCard tone={TONE} mark="token" title={copy.link.title} url={copy.link.url} />
    </ProductScreen>
  )
}

/** A block of the page's rows; a row with somewhere to go becomes a way there. */
function Rows({ rows }: { rows: readonly TokenPageRow[] }) {
  return (
    <ProductGroup>
      {rows.map((row) => (
        <Row key={row.key} row={row} />
      ))}
    </ProductGroup>
  )
}

function Row({ row }: { row: TokenPageRow }) {
  const readout =
    row.value === undefined
      ? {}
      : {
          value: row.value,
          ...(row.valueLabel === undefined ? {} : { valueLabel: row.valueLabel }),
        }
  const { to } = row
  return to ? (
    <FeatureCard
      tone={TONE}
      icon={row.icon}
      title={row.title}
      body={row.body}
      {...readout}
      onPress={GO[to]}
    />
  ) : (
    <FeatureCard tone={TONE} icon={row.icon} title={row.title} body={row.body} {...readout} />
  )
}
