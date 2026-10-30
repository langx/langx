/**
 * The 3.1 store set: what each shot is, how it is captured, what it says, and
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
  'venus',
]

/**
 * Shots for a product page optimization treatment, not for the listing: each
 * is composed for the App Store slots only, into a tree of its own
 * (`<locale>/ppo/ios/…`), so a listing slot still holds exactly `ORDER`.
 * `venusLead` is the lead of a Venus-led treatment.
 */
export const PPO = ['venusLead']

/** Play takes up to eight per slot; Home is App Store only. */
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
 * presses the last element whose text is exactly that, `{ reveal: { src,
 * top } }` scrolls until the first image whose address holds `src` is `top`
 * px down, and `{ seek: s }` holds every video on the frame `s` seconds in.
 * `venusPlayer: true` lets today's Venus video open by itself; every other
 * shot has it marked as already seen.
 */
export const SHOTS = {
  partners: { ground: 'sky', path: '/discover' },
  corrections: { ground: 'mint', path: '/chat/{anna}' },
  echo: { ground: 'lilac', path: '/echo' },
  streak: { ground: 'tangerine', path: '/streak' },
  calls: { ground: 'aqua', path: '/home', steps: [{ ring: 'video' }] },
  home: { ground: 'paper', path: '/home' },
  store: { ground: 'ink', path: '/wallet/store' },
  /*
   * 3.1's addition, in the place Badges had in 3.0 (a sheet over a dimmed
   * screen, and the shot that said least about LangX). Venus's page at her
   * videos: today's, then the newest days reached. `reveal` scrolls to the
   * first cover, so the grid sits at the same height in every locale however
   * the words above it wrap; the wait is for the covers to load.
   */
  venus: {
    ground: 'lime',
    path: '/venus',
    steps: [{ reveal: { src: 'venus-day', top: 100 }, wait: 6000 }],
  },
  /*
   * The PPO lead: today's video itself, opening on Home as it does the first
   * time a day counts, held on the frame where Venus is saying her line (the
   * line is the video's own, in the locale's language).
   *
   * `tabletShowTo`: on a tablet tile the phone is wide enough to run Venus's
   * subtitle bubble off the bottom edge, so it shrinks, from its top edge,
   * until this fraction of the capture (the bubble ends at about 0.79) sits
   * above a margin at the foot of the tile. Phone tiles already show it.
   */
  venusLead: {
    ground: 'tangerine',
    path: '/home',
    venusPlayer: true,
    wait: 9000,
    steps: [{ seek: 5.5 }],
    tabletShowTo: 0.8,
  },
  /*
   * No Pro shot. 3.0 and the first 3.1 set ended on the paywall (shot 9),
   * cut above its prices; Apple rejected 3.1 under guideline 2.3.7 on 30 Oct
   * 2026 for "free" in the screenshots, and the paywall's compare table has a
   * Free column, which counts. No caption names a price or the word free.
   */
}

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
 * `apps/mobile/src/i18n/messages/<locale>.ts` (Echo, the freeze).
 *
 * `streak` names nothing done with a partner: the 3.0 streak screen has no
 * pair streaks (see `StreakScreenV3.tsx`), and a caption claims only what the
 * screen does.
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
      'Hold a message to correct it. They see exactly what changed.',
    ],
    echo: [
      'Your chats become flashcards',
      'Save a line or a fix to Echo. It comes back before you’d forget it.',
    ],
    streak: ['Keep your streak going', 'Write a little every day. A freeze covers a day you miss.'],
    calls: [
      'Call when you’re ready',
      'Voice and video calls, right from the chat with your partner.',
    ],
    home: ['One next step, every day', 'Who is waiting for you, and three small things for today.'],
    store: [
      'Dress up with what you earn',
      'Frames, titles and stickers, for points you earn by taking part.',
    ],
    venus: [
      'Your streak, cheered on by Venus',
      'A short video from LangX’s cat for each day your streak counts.',
    ],
    venusLead: [
      'Practise every day with Venus',
      'Swap languages with real people. Venus has a video for each streak day.',
    ],
  },
  tr: {
    reviewed: false,
    partners: [
      'Gerçek insanlarla dil takası',
      'Öğrendiğin dili konuşuyorlar, konuştuğun dili öğreniyorlar.',
    ],
    corrections: [
      'Birbirinizi düzeltin',
      'Düzeltmek için mesaja basılı tut. Neyin değiştiğini tam olarak görür.',
    ],
    echo: [
      'Sohbetlerin kartlara dönüşür',
      'Bir cümleyi ya da düzeltmeyi Echo’ya kaydet. Unutmadan geri gelir.',
    ],
    streak: ['Serini sürdür', 'Her gün biraz yaz. Kaçırdığın bir günü dondurma kurtarır.'],
    calls: ['Hazır olduğunda ara', 'Partnerinle sohbetin içinden sesli ve görüntülü arama.'],
    home: ['Her gün tek bir sonraki adım', 'Seni kim bekliyor, bir de bugün için üç küçük şey.'],
    store: [
      'Kazandığınla profilini süsle',
      'Çerçeveler, unvanlar ve stickerlar; katılarak kazandığın puanlarla.',
    ],
    venus: ['Venus serini kutluyor', 'Serindeki her gün için LangX’in kedisinden kısa bir video.'],
    venusLead: [
      'Venus’la her gün pratik yap',
      'Gerçek insanlarla dil takası. Serindeki her gün için Venus’tan bir video.',
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
      'Mantén pulsado un mensaje para corregirlo. Verá exactamente qué cambió.',
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
      'Llamadas de voz y vídeo, desde el mismo chat con tu compañero.',
    ],
    home: ['Un siguiente paso, cada día', 'Quién te espera y tres cosas pequeñas para hoy.'],
    store: [
      'Viste tu perfil con lo que ganas',
      'Marcos, títulos y stickers a cambio de puntos que ganas participando.',
    ],
    venus: [
      'Venus celebra tu racha',
      'Un vídeo corto de la gata de LangX por cada día de tu racha.',
    ],
    venusLead: [
      'Aprende cada día con Venus',
      'Practica idiomas con gente real. Venus te deja un vídeo cada día de racha.',
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
      'Удерживайте сообщение, чтобы исправить. Собеседник увидит, что изменилось.',
    ],
    echo: [
      'Чаты превращаются в карточки',
      'Сохраните фразу или исправление в Echo — оно вернётся, пока не забылось.',
    ],
    streak: [
      'Не прерывайте серию',
      'Пишите понемногу каждый день. Заморозка спасёт пропущенный день.',
    ],
    calls: ['Звоните, когда будете готовы', 'Аудио- и видеозвонки прямо из чата с собеседником.'],
    home: ['Один следующий шаг каждый день', 'Кто вас ждёт — и три небольших дела на сегодня.'],
    store: [
      'Украшайте профиль заработанным',
      'Рамки, титулы и стикеры — за баллы, которые вы получаете за участие.',
    ],
    venus: [
      'Venus болеет за вашу серию',
      'Короткое видео от кошки LangX за каждый день вашей серии.',
    ],
    venusLead: [
      'Практика каждый день с Venus',
      'Обмен языками с живыми людьми. За каждый день серии — видео от Venus.',
    ],
  },
  ar: {
    reviewed: false,
    partners: ['تبادل اللغات مع أشخاص حقيقيين', 'يتحدثون ما تتعلمه، ويتعلمون ما تتحدثه.'],
    corrections: [
      'صحّحوا جمل بعضكم',
      'اضغط مطولًا على رسالة لتصحيحها. سيرى شريكك بالضبط ما الذي تغيّر.',
    ],
    echo: ['محادثاتك تصبح بطاقات', 'احفظ جملة أو تصحيحًا في Echo. يعود إليك قبل أن تنساه.'],
    streak: ['حافظ على سلسلتك', 'اكتب قليلًا كل يوم. التجميد يغطي يومًا تفوّته.'],
    calls: ['اتصل حين تكون مستعدًا', 'مكالمات صوتية ومكالمات فيديو من داخل المحادثة مع شريكك.'],
    home: ['خطوة تالية واحدة كل يوم', 'من ينتظرك، وثلاثة أشياء صغيرة لليوم.'],
    store: ['زيّن ملفك بما تكسبه', 'إطارات وألقاب وملصقات مقابل نقاط تكسبها بالمشاركة.'],
    venus: ['Venus تشجّعك على سلسلتك', 'فيديو قصير من قطة LangX لكل يوم في سلسلتك.'],
    venusLead: [
      'تدرّب كل يوم مع Venus',
      'تبادل اللغات مع أشخاص حقيقيين، ولكل يوم في سلسلتك فيديو من Venus.',
    ],
  },
  fr: {
    reviewed: false,
    partners: [
      'Échangez avec des gens réels',
      'Ils parlent la langue que vous apprenez, et apprennent la vôtre.',
    ],
    corrections: [
      'Corrigez-vous l’un l’autre',
      'Appui long sur un message pour le corriger. L’autre voit ce qui a changé.',
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
      'Appels vocaux et vidéo, depuis la conversation avec votre partenaire.',
    ],
    home: [
      'Une prochaine étape, chaque jour',
      'Qui vous attend, et trois petites choses pour aujourd’hui.',
    ],
    store: [
      'Habillez votre profil',
      'Cadres, titres et stickers, contre des points gagnés en participant.',
    ],
    venus: [
      'Venus encourage votre série',
      'Une courte vidéo de la chatte de LangX pour chaque jour de série.',
    ],
    venusLead: [
      'Pratiquez chaque jour avec Venus',
      'Échangez avec des gens réels. Venus a une vidéo pour chaque jour de série.',
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
      'Nachricht gedrückt halten, korrigieren. Dein Gegenüber sieht jede Änderung.',
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
      'Sprach- und Videoanrufe direkt im Chat mit deinem Gegenüber.',
    ],
    home: [
      'Jeden Tag ein nächster Schritt',
      'Wer auf dich wartet, und drei kleine Dinge für heute.',
    ],
    store: [
      'Mit Verdientem schmücken',
      'Rahmen, Titel und Sticker für Punkte, die du beim Mitmachen sammelst.',
    ],
    venus: [
      'Venus feuert deine Serie an',
      'Ein kurzes Video von der LangX-Katze für jeden Tag deiner Serie.',
    ],
    venusLead: [
      'Jeden Tag üben mit Venus',
      'Sprachtausch mit echten Menschen. Venus hat ein Video für jeden Serientag.',
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
      'Toque e segure uma mensagem para corrigir. A pessoa vê o que mudou.',
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
      'Chamadas de voz e vídeo, direto do chat com seu parceiro.',
    ],
    home: [
      'Um próximo passo, todo dia',
      'Quem está esperando por você e três coisinhas para hoje.',
    ],
    store: [
      'Enfeite-se com o que ganha',
      'Molduras, títulos e stickers em troca de pontos ganhos participando.',
    ],
    venus: [
      'A Venus torce pela sua sequência',
      'Um vídeo curtinho da gata da LangX para cada dia da sua sequência.',
    ],
    venusLead: [
      'Pratique todo dia com a Venus',
      'Converse com pessoas reais. A Venus manda um vídeo a cada dia de sequência.',
    ],
  },
}

/** Refuses a locale with a missing field rather than falling back to English. */
export function captionsFor(locale) {
  const table = CAPTIONS[locale]
  if (!table) throw new Error(`no captions for ${locale}`)
  for (const id of [...ORDER, ...PPO]) {
    const pair = table[id]
    if (!Array.isArray(pair) || pair.length !== 2 || !pair[0] || !pair[1]) {
      throw new Error(`captions.${locale}.${id} is missing a headline or a support line`)
    }
  }
  return table
}
