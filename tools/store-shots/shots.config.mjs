/**
 * The 3.0 store set: what each shot is, how it is captured, what it says, and
 * every size it is delivered at. The composer and the capture both read this
 * file and nothing else, so a change of order or wording is one edit here.
 *
 * Order is store order. The custom product pages reorder by `id`, never by
 * position, so ids are stable names.
 */

/** Store order. `calls` is fifth until the PPO result says otherwise. */
export const ORDER = [
  'partners',
  'corrections',
  'echo',
  'streak',
  'calls',
  'home',
  'store',
  'badges',
  'pro',
]

/** Play takes eight per slot; Home is App Store only. */
export const PLAY_SKIPS = ['home']

export const HUES = {
  sky: '#74b9ff',
  mint: '#5fdc98',
  lilac: '#bba4ff',
  tangerine: '#ff9f52',
  aqua: '#48d3d0',
  paper: '#f2f2ee',
  ink: '#14161b',
  lime: '#b8e15c',
  blue: '#3b6cf6',
}

/**
 * How each screen is reached on the web build, signed in as @sofia.
 *
 * `path` may name `{anna}` (Sofia's thread with Anna). `steps` run after the
 * screen settles: `{ scroll: px }` scrolls the screen's own list, `{ ring:
 * 'video' }` has Anna start a real call through the socket, `{ tap: text }`
 * presses the last element whose text is exactly that.
 */
export const SHOTS = {
  partners: { ground: 'sky', path: '/discover' },
  corrections: { ground: 'mint', path: '/chat/{anna}' },
  echo: { ground: 'lilac', path: '/echo' },
  streak: { ground: 'tangerine', path: '/streak' },
  calls: { ground: 'aqua', path: '/home', steps: [{ ring: 'video' }] },
  home: { ground: 'paper', path: '/home' },
  store: { ground: 'ink', path: '/wallet/store' },
  // The new-badge sheet, with its Share button, sits at the foot of the
  // screen: `fit: 'whole'` draws the phone small enough to show all of it.
  badges: { ground: 'lime', path: '/badges', newBadge: 'streak.180', fit: 'whole' },
  pro: { ground: 'blue', path: '/paywall' },
}

/**
 * Shot 9 shows whatever prices the storefront shows. Whether a store picture
 * should show a price at all is an open call, so both are made: `prices`
 * as captured, and `no-prices`, where the phone is lowered until the plan
 * cards (the first element at or below `cutAt` of the screen that names a
 * price) run off the bottom of the tile.
 */
export const PRO_VARIANTS = ['prices', 'no-prices']

/**
 * Every slot, at the pixel size its store accepts (verified 21 Oct 2026 —
 * see README.md for the sources). `kind` picks the composition: `phone` is a
 * phone-shaped tile, `tablet` the phone on a wider canvas.
 */
export const SLOTS = [
  { store: 'ios', dir: 'ios/6.9', w: 1320, h: 2868, kind: 'phone', bezel: 'island' },
  { store: 'ios', dir: 'ios/6.3', w: 1206, h: 2622, kind: 'phone', bezel: 'island' },
  { store: 'ios', dir: 'ios/5.5', w: 1242, h: 2208, kind: 'phone', bezel: 'island' },
  { store: 'ios', dir: 'ios/13', w: 2064, h: 2752, kind: 'tablet', bezel: 'island' },
  { store: 'play', dir: 'android/phone', w: 1440, h: 2560, kind: 'phone', bezel: 'punch' },
  { store: 'play', dir: 'android/7tablet', w: 1080, h: 1920, kind: 'tablet', bezel: 'punch' },
  { store: 'play', dir: 'android/10tablet', w: 1440, h: 2560, kind: 'tablet', bezel: 'punch' },
]
export const FEATURE_GRAPHIC = { file: 'android-feature-graphic.png', w: 1024, h: 500 }

export const LOCALES = ['en', 'tr', 'es', 'ru', 'ar', 'fr', 'de', 'pt-BR']
/** Play has no Russian or Arabic listing; those readers get the default one. */
export const PLAY_LOCALES = ['en', 'tr', 'es', 'fr', 'de', 'pt-BR']
export const RTL = ['ar']

/** Length budget per field, in characters. The composer warns past it. */
export const BUDGET = { headline: 32, support: 75 }

/**
 * The words. English is the source; every other locale is unreviewed until a
 * native speaker reads it (Turkish: Behic). Where a caption names something
 * on screen it uses that locale's own word for it from
 * `apps/mobile/src/i18n/messages/<locale>.ts` (Echo, Pro, the freeze).
 *
 * `streak` does not say "together": the drawing's pair flames are not in the
 * 3.0 streak screen (see `StreakScreenV3.tsx`), so a caption about keeping a
 * streak with a partner would describe something the app does not do. The
 * board's line, for when they ship: "Keep the streak going, together" /
 * "Write a little every day, and see how long you and a partner keep it up."
 */
export const CAPTIONS = {
  en: {
    reviewed: true,
    partners: [
      'Swap languages with real people',
      'They speak what you’re learning, and learn what you speak.',
    ],
    corrections: [
      'Fix each other’s sentences',
      'Hold a message to correct it. Free on every plan.',
    ],
    echo: [
      'Your chats become flashcards',
      'Save a line or a fix to Echo. It comes back before you’d forget it.',
    ],
    streak: ['Keep your streak going', 'Write a little every day. A freeze covers a day you miss.'],
    calls: ['Call when you’re ready', 'Voice and video, right from the chat. Free on every plan.'],
    home: ['One next step, every day', 'Who is waiting for you, and three small things for today.'],
    store: [
      'Dress up with what you earn',
      'Frames, titles and stickers, paid for in points you earn by taking part.',
    ],
    badges: [
      'Badges for what you really do',
      'Corrections, calls, reviews, streaks. Share the ones you like.',
    ],
    pro: [
      'More room with Pro',
      'Unlimited new chats and translations. Replies and corrections stay free.',
    ],
  },
  tr: {
    reviewed: false,
    partners: [
      'Gerçek insanlarla dil takası',
      'Öğrendiğin dili konuşuyorlar, konuştuğun dili öğreniyorlar.',
    ],
    corrections: ['Birbirinizi düzeltin', 'Düzeltmek için mesaja basılı tut. Her planda ücretsiz.'],
    echo: [
      'Sohbetlerin kartlara dönüşür',
      'Bir cümleyi ya da düzeltmeyi Echo’ya kaydet. Unutmadan geri gelir.',
    ],
    streak: ['Serini sürdür', 'Her gün biraz yaz. Kaçırdığın bir günü dondurma kurtarır.'],
    calls: [
      'Hazır olduğunda ara',
      'Sohbetin içinden sesli ve görüntülü arama. Her planda ücretsiz.',
    ],
    home: ['Her gün tek bir sonraki adım', 'Seni kim bekliyor, bir de bugün için üç küçük şey.'],
    store: [
      'Kazandığınla profilini süsle',
      'Çerçeveler, unvanlar ve stickerlar; katılarak kazandığın puanlarla.',
    ],
    badges: [
      'Yaptıkların için rozetler',
      'Düzeltmeler, aramalar, tekrarlar, seriler. Beğendiklerini paylaş.',
    ],
    pro: [
      'Pro ile daha fazla alan',
      'Sınırsız yeni sohbet ve çeviri. Yanıtlar ve düzeltmeler ücretsiz kalır.',
    ],
  },
  es: {
    reviewed: false,
    partners: [
      'Practica idiomas con gente real',
      'Hablan lo que aprendes y aprenden lo que hablas.',
    ],
    corrections: [
      'Corrige y te corrigen',
      'Mantén pulsado un mensaje para corregirlo. Gratis en todos los planes.',
    ],
    echo: [
      'Tus chats se vuelven tarjetas',
      'Guarda una frase o una corrección en Echo. Vuelve antes de que la olvides.',
    ],
    streak: [
      'Mantén tu racha',
      'Escribe un poco cada día. Una congelación cubre el día que faltes.',
    ],
    calls: [
      'Llama cuando estés listo',
      'Voz y vídeo, desde el mismo chat. Gratis en todos los planes.',
    ],
    home: ['Un siguiente paso, cada día', 'Quién te espera y tres cosas pequeñas para hoy.'],
    store: [
      'Viste tu perfil con lo que ganas',
      'Marcos, títulos y stickers que pagas con puntos que ganas participando.',
    ],
    badges: [
      'Insignias por lo que haces',
      'Correcciones, llamadas, repasos, rachas. Comparte las que te gusten.',
    ],
    pro: [
      'Más espacio con Pro',
      'Chats nuevos y traducciones ilimitados. Responder y corregir sigue gratis.',
    ],
  },
  ru: {
    reviewed: false,
    partners: [
      'Обмен языками с живыми людьми',
      'Они говорят на том, что вы учите, и учат то, на чём говорите вы.',
    ],
    corrections: [
      'Исправляйте друг друга',
      'Удерживайте сообщение, чтобы исправить. Бесплатно на любом тарифе.',
    ],
    echo: [
      'Чаты превращаются в карточки',
      'Сохраните фразу или исправление в Echo — оно вернётся до того, как забудется.',
    ],
    streak: [
      'Не прерывайте серию',
      'Пишите понемногу каждый день. Заморозка спасёт пропущенный день.',
    ],
    calls: [
      'Звоните, когда будете готовы',
      'Голос и видео прямо из чата. Бесплатно на любом тарифе.',
    ],
    home: ['Один следующий шаг каждый день', 'Кто вас ждёт — и три небольших дела на сегодня.'],
    store: [
      'Украшайте профиль заработанным',
      'Рамки, титулы и стикеры — за баллы, которые вы получаете за участие.',
    ],
    badges: [
      'Значки за реальные дела',
      'Исправления, звонки, повторения, серии. Делитесь любимыми.',
    ],
    pro: [
      'Больше возможностей с Pro',
      'Безлимитные новые чаты и переводы. Ответы и исправления — бесплатно.',
    ],
  },
  ar: {
    reviewed: false,
    partners: ['تبادل اللغات مع أشخاص حقيقيين', 'يتحدثون ما تتعلمه، ويتعلمون ما تتحدثه.'],
    corrections: ['صحّحوا جمل بعضكم', 'اضغط مطولًا على رسالة لتصحيحها. مجاني في كل الخطط.'],
    echo: ['محادثاتك تصبح بطاقات', 'احفظ جملة أو تصحيحًا في Echo. يعود إليك قبل أن تنساه.'],
    streak: ['حافظ على سلسلتك', 'اكتب قليلًا كل يوم. التجميد يغطي يومًا تفوّته.'],
    calls: ['اتصل حين تكون مستعدًا', 'صوت وفيديو من داخل المحادثة. مجاني في كل الخطط.'],
    home: ['خطوة تالية واحدة كل يوم', 'من ينتظرك، وثلاثة أشياء صغيرة لليوم.'],
    store: ['زيّن ملفك بما تكسبه', 'إطارات وألقاب وملصقات، تدفع ثمنها بنقاط تكسبها بالمشاركة.'],
    badges: ['شارات لما تفعله حقًا', 'تصحيحات، مكالمات، مراجعات، سلاسل. شارك ما يعجبك منها.'],
    pro: ['مساحة أكبر مع Pro', 'محادثات جديدة وترجمات بلا حدود. الردود والتصحيحات تبقى مجانية.'],
  },
  fr: {
    reviewed: false,
    partners: [
      'Échangez avec des gens réels',
      'Ils parlent la langue que vous apprenez, et apprennent la vôtre.',
    ],
    corrections: [
      'Corrigez-vous l’un l’autre',
      'Appui long sur un message pour le corriger. Gratuit pour tous.',
    ],
    echo: [
      'Vos chats deviennent des fiches',
      'Gardez une phrase ou une correction dans Echo. Elle revient avant l’oubli.',
    ],
    streak: [
      'Gardez votre série',
      'Écrivez un peu chaque jour. Un gel couvre le jour où vous manquez.',
    ],
    calls: [
      'Appelez quand vous le sentez',
      'Voix et vidéo, depuis la conversation. Gratuit dans toutes les formules.',
    ],
    home: [
      'Une prochaine étape, chaque jour',
      'Qui vous attend, et trois petites choses pour aujourd’hui.',
    ],
    store: [
      'Habillez votre profil',
      'Cadres, titres et stickers, payés avec les points gagnés en participant.',
    ],
    badges: [
      'Des badges bien mérités',
      'Corrections, appels, révisions, séries. Partagez ceux qui vous plaisent.',
    ],
    pro: [
      'Plus de place avec Pro',
      'Chats et traductions illimités. Répondre et corriger reste gratuit.',
    ],
  },
  de: {
    reviewed: false,
    partners: [
      'Sprachtausch mit echten Menschen',
      'Sie sprechen, was du lernst, und lernen, was du sprichst.',
    ],
    corrections: [
      'Korrigiert euch gegenseitig',
      'Nachricht gedrückt halten und korrigieren. In jedem Tarif kostenlos.',
    ],
    echo: [
      'Aus Chats werden Lernkarten',
      'Sätze und Korrekturen in Echo sichern. Sie kommen, bevor du sie vergisst.',
    ],
    streak: [
      'Halte deine Serie',
      'Schreib jeden Tag ein bisschen. Serienschutz deckt einen verpassten Tag.',
    ],
    calls: [
      'Ruf an, wenn du so weit bist',
      'Sprach- und Videoanrufe direkt im Chat. In jedem Tarif kostenlos.',
    ],
    home: [
      'Jeden Tag ein nächster Schritt',
      'Wer auf dich wartet, und drei kleine Dinge für heute.',
    ],
    store: [
      'Mit Verdientem schmücken',
      'Rahmen, Titel und Sticker für Punkte, die du beim Mitmachen sammelst.',
    ],
    badges: [
      'Abzeichen für das, was du tust',
      'Korrekturen, Anrufe, Wiederholungen, Serien. Teile, was dir gefällt.',
    ],
    pro: [
      'Mehr Raum mit Pro',
      'Unbegrenzt neue Chats und Übersetzungen. Antworten und Korrigieren gratis.',
    ],
  },
  'pt-BR': {
    reviewed: false,
    partners: [
      'Troque idiomas com pessoas reais',
      'Elas falam o que você aprende e aprendem o que você fala.',
    ],
    corrections: [
      'Corrijam as frases um do outro',
      'Toque e segure uma mensagem para corrigir. Grátis em todos os planos.',
    ],
    echo: [
      'Suas conversas viram flashcards',
      'Salve uma frase ou correção no Echo. Ela volta antes de você esquecer.',
    ],
    streak: [
      'Mantenha sua sequência',
      'Escreva um pouco todo dia. Um congelamento cobre o dia que você perder.',
    ],
    calls: [
      'Ligue quando estiver pronto',
      'Voz e vídeo, direto do chat. Grátis em todos os planos.',
    ],
    home: [
      'Um próximo passo, todo dia',
      'Quem está esperando por você e três coisinhas para hoje.',
    ],
    store: [
      'Enfeite-se com o que ganha',
      'Molduras, títulos e stickers pagos com pontos que você ganha participando.',
    ],
    badges: [
      'Medalhas pelo que você faz',
      'Correções, chamadas, revisões, sequências. Compartilhe as que curtir.',
    ],
    pro: [
      'Mais espaço com o Pro',
      'Novos chats e traduções ilimitados. Respostas e correções seguem grátis.',
    ],
  },
}

/** Refuses a locale with a missing field rather than falling back to English. */
export function captionsFor(locale) {
  const table = CAPTIONS[locale]
  if (!table) throw new Error(`no captions for ${locale}`)
  for (const id of ORDER) {
    const pair = table[id]
    if (!Array.isArray(pair) || pair.length !== 2 || !pair[0] || !pair[1]) {
      throw new Error(`captions.${locale}.${id} is missing a headline or a support line`)
    }
  }
  return table
}
