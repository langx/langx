import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { cardElement } from '../modules/cards/design'
import { recapCardContent } from '../modules/cards/recapCard'
import { recapForYear } from '../modules/notifications/newsletter'
import { recapCardElement } from '../modules/cards/recapDesign'
import { recapSlideElement } from '../modules/cards/recapSlideDesign'
import { renderCard } from '../modules/cards/render'
import type { StorageProviderWithPut, UploadUrl } from '../storage/StorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/** What the app sends beside a recap card: words only, never the numbers. */
const RECAP_WORDS = {
  locale: 'en',
  kicker: 'My month',
  labels: {
    messages: 'messages sent',
    corrections: 'sentences corrected',
    echoReviews: 'Echo cards reviewed',
    activeDays: 'days active',
    currentStreak: 'day streak, still going',
    tokens: 'tokens earned',
  },
  people: 'in two languages, with 12 people',
  languages: 'Spanish → learning Turkish',
} as const

/** Holds the bytes instead of talking to B2, and answers with a public URL. */
class MemoryStorage implements StorageProviderWithPut {
  readonly objects = new Map<string, Uint8Array>()

  getUploadUrl(): Promise<UploadUrl> {
    throw new Error('not used')
  }
  putObject(key: string, body: Uint8Array): Promise<string> {
    this.objects.set(key, body)
    return Promise.resolve(`https://media.example.test/${key}`)
  }
  getObject(key: string): Promise<Uint8Array> {
    const bytes = this.objects.get(key)
    if (!bytes) throw new Error(`No such object: ${key}`)
    return Promise.resolve(bytes)
  }
  deleteObject(key: string): Promise<void> {
    this.objects.delete(key)
    return Promise.resolve()
  }
  keyFromPublicUrl(url: string): string | null {
    const prefix = 'https://media.example.test/'
    return url.startsWith(prefix) ? url.slice(prefix.length) : null
  }
}

describe('share cards', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let storage: MemoryStorage
  let cookie: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_cards_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_cards_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: 'test-legacy-salt',
    })

    const emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    storage = new MemoryStorage()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      email: emailSender,
    })
    await app.ready()

    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'card@example.com',
      password: PASSWORD,
      name: 'Card Haver',
    })
    cookie = user.cookie
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'cardhaver',
        displayName: 'Card Haver',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(created.statusCode, created.body).toBe(201)
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  function make(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/me/share-card', headers: { cookie }, payload })
  }

  it('renders a PNG, stores it, and hands back the page rather than the picture', async () => {
    const response = await make({
      kind: 'streak',
      shape: 'story',
      headline: '47',
      caption: 'day streak on LangX',
    })
    expect(response.statusCode, response.body).toBe(201)
    const body = response.json<{ id: string; imageUrl: string; shareUrl: string }>()

    // The shared link is the page. A raw bucket URL unfurls as a bare image
    // with no title and gives whoever taps it nowhere to go.
    expect(body.shareUrl).toBe(`https://app.langx.io/s/${body.id}`)
    expect(body.imageUrl).toContain(`cards/`)

    const key = storage.keyFromPublicUrl(body.imageUrl)
    expect(key).not.toBeNull()
    const bytes = storage.objects.get(key!)
    expect(bytes).toBeDefined()
    // The PNG magic number, so this asserts a picture rather than a length.
    expect(Array.from(bytes!.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 60_000)

  it('puts the caller own handle on the card, whatever the body says', async () => {
    const created = await make({
      kind: 'badge',
      shape: 'wide',
      headline: 'First Correction',
      caption: 'badge earned',
      // Not a field the schema has — a card is a claim about who did the
      // thing, so the handle is read from the profile and never from here.
      handle: '@someone-else',
    })
    expect(created.statusCode, created.body).toBe(201)
    const { id } = created.json<{ id: string }>()

    const page = await app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect(page.statusCode, page.body).toBe(200)
    expect(page.json<{ handle: string }>().handle).toBe('@cardhaver')
  }, 60_000)

  it('serves the card to a stranger, and 404s an id that is not one', async () => {
    const created = await make({
      kind: 'rank',
      shape: 'square',
      headline: '#3',
      caption: 'on the LangX token board',
    })
    const { id } = created.json<{ id: string }>()

    // No cookie: this is the page a link lands on.
    const page = await app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect(page.statusCode).toBe(200)
    const card = page.json<{ kind: string; shape: string; imageUrl: string }>()
    expect(card.kind).toBe('rank')
    expect(card.shape).toBe('square')

    const missing = await app.inject({ method: 'GET', url: '/public/share/deadbeefdeadbeef' })
    expect(missing.statusCode).toBe(404)
  }, 60_000)

  /**
   * The line `getSharedProfile` draws, drawn here too. A card is the app's
   * other unauthenticated read, at another address and carrying the same
   * handle, and it used to answer for an account the profile page refuses to
   * confirm exists.
   *
   * Both states are reversible, and the page comes back on its own for both:
   * nothing is deleted, the read simply stops finding an owner it may show.
   */
  it('stops serving a card while its owner is suspended, and serves it again after', async () => {
    const created = await make({
      kind: 'streak',
      shape: 'story',
      headline: '9',
      caption: 'day streak on LangX',
    })
    const { id } = created.json<{ id: string }>()
    const page = () => app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect((await page()).statusCode).toBe(200)

    const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)
    await profiles.updateOne(
      { handle: 'cardhaver' },
      {
        $set: {
          suspension: {
            at: new Date(),
            until: new Date(Date.now() + 24 * 60 * 60 * 1000),
            permanent: false,
            reason: 'harassment',
          },
        },
      },
    )
    // 404, not 403: a refusal that confirms the card exists is a refusal that
    // answers the question it was meant to close.
    expect((await page()).statusCode).toBe(404)

    await profiles.updateOne({ handle: 'cardhaver' }, { $unset: { suspension: '' } })
    expect((await page()).statusCode).toBe(200)
  }, 60_000)

  it('stops serving a card while its owner is inside the deletion grace period', async () => {
    const created = await make({
      kind: 'badge',
      shape: 'wide',
      headline: 'First Correction',
      caption: 'badge earned',
    })
    const { id } = created.json<{ id: string }>()
    const page = () => app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect((await page()).statusCode).toBe(200)

    const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)
    await profiles.updateOne({ handle: 'cardhaver' }, { $set: { deletedAt: new Date() } })
    expect((await page()).statusCode).toBe(404)

    // Signing back in is the cancel gesture, and the card is theirs again.
    await profiles.updateOne({ handle: 'cardhaver' }, { $unset: { deletedAt: '' } })
    expect((await page()).statusCode).toBe(200)
  }, 60_000)

  it('refuses a card for somebody who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/me/share-card',
      payload: { kind: 'streak', shape: 'story', headline: '1', caption: 'day' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('answers the recap from the ledger rows, and a recap card is a kind the page can read', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'cardhaver' })
    const userId = profile!._id
    await handle.db.collection(COLLECTIONS.dailyActivity).insertMany([
      { userId, day: '2026-08-03', messages: 4, corrections: 1 },
      { userId, day: '2026-08-20', messages: 6, corrections: 2 },
      // The next month's row must not leak into August.
      { userId, day: '2026-09-01', messages: 50, corrections: 50 },
    ] as never[])
    await handle.db
      .collection(COLLECTIONS.echoAggregates)
      .insertOne({ _id: `${userId}:month:2026-08`, userId, reviews: 31 } as never)

    const recap = await app.inject({
      method: 'GET',
      url: '/me/recap?month=2026-08',
      headers: { cookie },
    })
    expect(recap.statusCode, recap.body).toBe(200)
    expect(recap.json()).toMatchObject({
      month: '2026-08',
      messages: 10,
      corrections: 3,
      echoReviews: 31,
    })

    const bad = await app.inject({
      method: 'GET',
      url: '/me/recap?month=2026-13',
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)
    const anon = await app.inject({ method: 'GET', url: '/me/recap' })
    expect(anon.statusCode).toBe(401)

    const year = await app.inject({
      method: 'GET',
      url: '/me/recap/year?year=2026',
      headers: { cookie },
    })
    expect(year.statusCode, year.body).toBe(200)
    expect(year.json()).toMatchObject({ year: '2026', messages: 60, corrections: 53 })
    const badYear = await app.inject({
      method: 'GET',
      url: '/me/recap/year?year=26',
      headers: { cookie },
    })
    expect(badYear.statusCode).toBe(400)

    const created = await make({
      kind: 'recap',
      shape: 'story',
      headline: 'August',
      caption: '10 messages · 31 Echo cards',
    })
    expect(created.statusCode, created.body).toBe(201)
    const page = await app.inject({
      method: 'GET',
      url: `/public/share/${created.json<{ id: string }>().id}`,
    })
    expect(page.statusCode, page.body).toBe(200)
    expect(page.json<{ kind: string }>().kind).toBe('recap')

    // With its wording, a recap is the poster — and still a 201 without a face.
    const poster = await make({
      kind: 'recap',
      shape: 'square',
      headline: 'August',
      caption: 'my month on LangX',
      recap: { ...RECAP_WORDS, month: '2026-08' },
    })
    expect(poster.statusCode, poster.body).toBe(201)
  }, 60_000)

  it('puts the ledger’s numbers on a recap poster, never the client’s', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'cardhaver' })
    const userId = profile!._id
    await handle.db.collection(COLLECTIONS.dailyActivity).insertMany([
      { userId, day: '2026-06-03', messages: 1200, corrections: 0 },
      { userId, day: '2026-06-04', messages: 34, corrections: 5 },
    ] as never[])
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { 'streak.current': 0 } })

    const content = await recapCardContent(handle.db, {
      userId,
      handle: '@cardhaver',
      monthName: 'juin',
      recap: { ...RECAP_WORDS, month: '2026-06', locale: 'fr' },
      storagePublicBaseUrl: undefined,
    })
    // French groups with a no-break space here (see recapCard.ts), and the
    // month is capitalised.
    expect(content.month).toBe('Juin')
    // No Echo row and no streak: the next numbers in line take their tiles.
    expect(content.stats.map((each) => [each.stat, each.value])).toEqual([
      ['messages', '1\u00a0234'],
      ['corrections', '5'],
      ['activeDays', '2'],
    ])
    // Nobody messaged by id this month, so the "with N people" line goes.
    expect(content.people).toBeUndefined()
    expect(content.languages).toBe('Spanish → learning Turkish')

    // A four-digit key is the year's card: the whole year's numbers, and the
    // year is the headline rather than a second time beside the kicker.
    await handle.db
      .collection(COLLECTIONS.dailyActivity)
      .insertOne({ userId, day: '2026-02-10', messages: 6, corrections: 0 })
    const year = await recapCardContent(handle.db, {
      userId,
      handle: '@cardhaver',
      monthName: '2026',
      recap: { ...RECAP_WORDS, month: '2026', locale: 'fr' },
      storagePublicBaseUrl: undefined,
    })
    expect(year.month).toBe('2026')
    expect(year.year).toBeUndefined()
    // February's six on top of June's 1,234 — and whatever earlier tests left
    // in this year, which is why the expected number is read, not written.
    const { messages } = await recapForYear(handle.db, userId, '2026')
    expect(messages).toBeGreaterThanOrEqual(1240)
    expect(year.stats[0]).toMatchObject({
      stat: 'messages',
      value: new Intl.NumberFormat('fr').format(messages).replace(/\u202f/g, '\u00a0'),
    })
  })

  it('draws one slide of the story as its own card, and only a slide the month earned', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'cardhaver' })
    const userId = profile!._id
    await handle.db.collection(COLLECTIONS.dailyActivity).insertMany([
      { userId, day: '2026-05-30', messages: 12, corrections: 0 },
      { userId, day: '2026-05-31', messages: 30, corrections: 0 },
    ] as never[])
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { 'streak.current': 2 } })
    const content = (slide: 'messages' | 'corrections' | 'streak') =>
      recapCardContent(handle.db, {
        userId,
        handle: '@cardhaver',
        monthName: 'May',
        recap: { ...RECAP_WORDS, month: '2026-05', slide },
        storagePublicBaseUrl: undefined,
      })

    // The number is the ledger's, under the label the app sent for it.
    expect((await content('messages')).slide).toMatchObject({
      slide: 'messages',
      value: '42',
      label: 'messages sent',
    })
    // The streak's card carries the month's calendar, the run ending on the 31st.
    const streak = (await content('streak')).slide
    expect(streak).toMatchObject({ value: '2', label: 'day streak, still going' })
    expect(streak?.days).toHaveLength(31)
    expect(streak?.days?.slice(-3)).toEqual(['idle', 'streak', 'streak'])
    // No corrections this month, so no corrections card: the summary instead.
    expect((await content('corrections')).slide).toBeUndefined()

    for (const [shape, expected] of [
      ['story', [1080, 1920]],
      ['square', [1080, 1080]],
      ['wide', [1200, 675]],
    ] as const) {
      const png = await renderCard(await recapSlideElement(streak!, shape), shape)
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([...expected])
    }
  }, 60_000)

  it('draws the recap poster at the size every shape claims', async () => {
    for (const [shape, expected] of [
      ['story', [1080, 1920]],
      ['square', [1080, 1080]],
      ['wide', [1200, 675]],
    ] as const) {
      const png = await renderCard(
        recapCardElement(
          {
            month: 'سبتمبر',
            year: '2026',
            kicker: 'شهري',
            people: 'بلغتين، مع 12 شخصًا',
            stats: [
              { stat: 'messages', value: '248', label: 'رسالة مرسلة' },
              { stat: 'corrections', value: '37', label: 'جملة مصحّحة' },
              { stat: 'echoReviews', value: '1,204', label: 'بطاقات صدى' },
            ],
            handle: '@cardhaver',
            languages: 'الإسبانية ← أتعلّم التركية',
            locale: 'ar',
          },
          shape,
        ),
        shape,
      )
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([...expected])
    }
  }, 60_000)

  it('draws every shape at the size it claims', async () => {
    // The three ratios exist so a card is not cropped or letterboxed by the
    // place it is posted; a shape that renders at the wrong size defeats that
    // silently, since the picture still looks fine on its own.
    const copy = { headline: '7', caption: 'day streak', handle: '@cardhaver' }
    for (const [shape, expected] of [
      ['story', [1080, 1920]],
      ['square', [1080, 1080]],
      ['wide', [1200, 675]],
    ] as const) {
      const png = await renderCard(await cardElement('streak', copy, shape), shape)
      // PNG puts width and height as big-endian 32-bit ints at offset 16.
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([...expected])
    }
  }, 60_000)
})
