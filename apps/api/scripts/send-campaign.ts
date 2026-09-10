/**
 * Queues one promotional email for everybody it may go to. The API sends it.
 *
 * This used to send from the laptop in one sitting. It now hands the campaign
 * to `campaignQueue`, and the API's notification scheduler drips it out on a
 * warm-up ramp (`CAMPAIGN_WARMUP_PER_DAY`, inside `CAMPAIGN_SEND_WINDOW_UTC`)
 * — a few hundred the first day, a few thousand by the fifth. Not for any
 * quota: a domain that goes from twenty mails a day to four thousand in an
 * hour gets throttled by the mailbox providers, and the penalty lands on the
 * verification links too. See `modules/notifications/campaignQueue.ts`.
 *
 * **Consent is decided by the source**, read at send time — never here:
 *
 *   consented  `promotions.email` true on the profile (the default)
 *   v1         plus every pre-created v1 row that has not said no
 *   all        plus everybody else with a verified address
 *   v1deleted  the addresses v1's deleted accounts left in `v1DeletedContacts`
 *
 * **Nobody is mailed twice.** Recipients are claimed into `emailCampaigns`
 * before each batch, and the unique index on `{campaignId, userId}` enforces
 * it across ticks, machines and restarts.
 *
 * Both bodies must contain `{{unsubscribeUrl}}`; the script refuses otherwise.
 * They may also carry `{{firstName}}` ("there" when unknown) and `{{email}}`
 * (URL-encoded, for `sign-in-link?email=`). A text part derived from the
 * HTML gets the unsubscribe link appended, since stripping tags takes away
 * the `href` it was written in.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/send-campaign.ts \
 *     --campaign 2026-09-launch --subject "LangX v2 is here" \
 *     --html-file campaigns/v1-launch.html [--text-file campaigns/v1-launch.txt] \
 *     [--source consented|v1|all|v1deleted] [--exclude-returned] [--locale tr] \
 *     [--ignore-cap] [--confirm]
 *
 *   scripts/send-campaign.ts --status
 *   scripts/send-campaign.ts --pause  --campaign 2026-09-launch
 *   scripts/send-campaign.ts --resume --campaign 2026-09-launch
 *
 * Without `--confirm` it counts and prints and queues nothing.
 */
import { readFileSync } from 'node:fs'
import { CAMPAIGN_SOURCES, type CampaignSource } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { deriveTextBody, UNSUBSCRIBE_PLACEHOLDER } from '../src/modules/notifications/campaign'
import {
  enqueueCampaign,
  listCampaigns,
  resolveCampaignAudience,
  setCampaignStatus,
} from '../src/modules/notifications/campaignQueue'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

async function main(): Promise<void> {
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    if (has('status')) {
      const campaigns = await listCampaigns(db)
      if (campaigns.length === 0) console.log('no campaigns queued')
      for (const campaign of campaigns) {
        console.log(
          `${campaign._id}  ${campaign.status.padEnd(7)}  ${campaign.sent}/${campaign.total} sent` +
            `${campaign.failed ? `, ${campaign.failed} failed` : ''}` +
            `  (${campaign.source}${campaign.excludeReturned ? ', exclude-returned' : ''}` +
            `${campaign.startedAt ? `, started ${campaign.startedAt.toISOString()}` : ''})`,
        )
      }
      return
    }

    const campaignId = flag('campaign')
    if (has('pause') || has('resume')) {
      if (!campaignId) throw new Error('--campaign is required')
      const status = has('pause') ? 'paused' : 'queued'
      const changed = await setCampaignStatus(db, campaignId, status)
      console.log(
        changed ? `${campaignId} → ${status}` : `${campaignId}: not found, or already done`,
      )
      return
    }

    const subject = flag('subject')
    const htmlFile = flag('html-file')
    const textFile = flag('text-file')
    const source = (flag('source') ?? 'consented') as CampaignSource
    const locale = flag('locale')
    const confirm = has('confirm')

    if (!campaignId || !subject || !htmlFile) {
      throw new Error('--campaign, --subject and --html-file are all required')
    }
    if (!CAMPAIGN_SOURCES.includes(source)) {
      throw new Error(`--source must be one of ${CAMPAIGN_SOURCES.join(', ')}`)
    }

    const html = readFileSync(htmlFile, 'utf8')
    if (!html.includes(UNSUBSCRIBE_PLACEHOLDER)) {
      throw new Error(
        `the html body must contain ${UNSUBSCRIBE_PLACEHOLDER} — refusing without one`,
      )
    }
    let text: string
    if (textFile) {
      text = readFileSync(textFile, 'utf8')
      if (!text.includes(UNSUBSCRIBE_PLACEHOLDER)) {
        throw new Error(
          `the text body must contain ${UNSUBSCRIBE_PLACEHOLDER} — refusing without one`,
        )
      }
    } else {
      text = deriveTextBody(html)
    }

    const campaign = {
      _id: campaignId,
      subject,
      html,
      text,
      source,
      excludeReturned: has('exclude-returned'),
      ...(locale ? { locale } : {}),
      ignoreCap: has('ignore-cap'),
    }

    const audience = await resolveCampaignAudience(db, campaign)
    console.log(`campaign ${campaignId} on ${env.MONGODB_DB} (source: ${source})`)
    console.log(`  recipients: ${audience.targets.length}`)
    console.log(`  skipped: ${JSON.stringify(audience.skipped)}`)
    for (const target of audience.targets.slice(0, 5)) {
      console.log(
        `    ${mask(target.email)} (${target.locale}${target.firstName ? `, ${target.firstName}` : ''})`,
      )
    }
    if (audience.targets.length > 5) console.log(`    …and ${audience.targets.length - 5} more`)

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to queue it)')
      return
    }

    await enqueueCampaign(db, { ...campaign, total: audience.targets.length })
    console.log(
      `\nqueued. The API sends it from the next tick inside the UTC window; ` +
        `watch with --status, stop with --pause --campaign ${campaignId}.`,
    )
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
