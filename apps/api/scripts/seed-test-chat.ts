/**
 * A conversation with a past: two accounts and about four months of evenings
 * between them, so the chat list, the thread, corrections, replies, reactions,
 * stars, the pin banner, an edit, a tombstone and an unread badge all have
 * something real to render before there are users.
 *
 * Long on purpose. `MESSAGE_PAGE_SIZE_DEFAULT` is 30, so a fixture of forty
 * messages proves nothing about scrolling — the first page holds the whole
 * thread and the cursor path never runs. This one is several hundred, which
 * makes "load older" a thing that happens repeatedly on the way to the top.
 *
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-chat.ts --db langx_dev
 *   pnpm --filter @langx/api exec tsx scripts/seed-test-chat.ts --db langx_dev --purge
 *
 * `--purge` is `testAccounts.ts`'s, shared with `seed-test-users.ts`: it takes
 * out every fixture account and the threads they are in, not only this pair.
 *
 * The two of them are a matched pair on purpose — each is native in what the
 * other is learning. A one-sided fixture can only ever show corrections going
 * one way, and the screen looks very different when the person reading it is
 * the one being corrected.
 *
 * Everything here is written through the same functions the API calls, down to
 * `startConversation` spending a quota slot. The one exception is the
 * timestamps: see `backdate` at the bottom for what that costs.
 */
import type { MessageReaction, OnboardingProfileInput } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../src/db/collections'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import {
  pairKeyFor,
  startConversation,
  type Conversation,
  type Message,
} from '../src/modules/chat/conversations'
import { markConversationRead, sendCorrection, sendTextMessage } from '../src/modules/chat/messages'
import {
  deleteMessage,
  editMessage,
  pinMessage,
  reactToMessage,
  starMessage,
} from '../src/modules/chat/mutations'
import { PASSWORD, emailFor, ensureAccount, purgeTestAccounts, resolveDbName } from './testAccounts'

type Side = 'george' | 'marina'

const CAST: Record<Side, OnboardingProfileInput> = {
  george: {
    handle: 'test_george',
    displayName: 'George',
    birthDate: '1993-06-15',
    gender: 'male',
    nativeLanguages: [{ code: 'en' }],
    learning: [{ code: 'ru', level: 'beginner', priority: 1 }],
    country: 'GB',
    city: 'Bristol',
    bio: 'Four months into Russian and still losing to the cases. I cook, I climb badly, I read about things I will never do.',
    interests: ['cooking', 'history', 'music', 'nature'],
  },
  marina: {
    handle: 'test_marina',
    displayName: 'Marina',
    birthDate: '1996-06-15',
    gender: 'female',
    nativeLanguages: [{ code: 'ru' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    country: 'RU',
    city: 'Novosibirsk',
    bio: 'Product designer. My reading is fine, my speaking is a disaster. Correct me, I asked for it.',
    interests: ['art', 'photography', 'travel', 'films'],
  },
}

function other(side: Side): Side {
  return side === 'george' ? 'marina' : 'george'
}

interface Turn {
  from: Side
  /** The message body — the corrected sentence when `corrects` is set. */
  body: string
  /** Set when a later turn points at this one. */
  id?: string
  /** Turn id this one corrects; that is what makes it a `correction`. */
  corrects?: string
  /** The teaching note that travels with a correction. */
  note?: string
  /** Turn id this one quotes. */
  replyTo?: string
  /** Put on this message by whoever did not send it — a reaction to yourself reads as a bug. */
  reaction?: MessageReaction
  /** Bookmarked by this side. Private, so the fixture is also a test that the other side cannot see it. */
  starredBy?: Side
  /** Pinned for both. There is one pin per conversation, so the last one here wins. */
  pinnedBy?: Side
  /** Rewritten by its sender afterwards, leaving `editedAt` for the "edited" label. */
  editedTo?: string
  /** Withdrawn by its sender — a tombstone, not a removal, and the timeline still has to render it. */
  withdrawn?: boolean
}

interface Session {
  daysAgo: number
  /** Wall-clock start, `HH:MM`, in whatever timezone the seed runs in. */
  at: string
  turns: Turn[]
}

/**
 * The last session is deliberately left unread: `markConversationRead` runs
 * for both of them before it, so George opens the app to a badge and Marina
 * to a thread with nothing outstanding. Both states are worth being able to
 * see without waiting for someone to send something.
 */
const SESSIONS: Session[] = [
  {
    daysAgo: 118,
    at: '09:12',
    turns: [
      {
        from: 'george',
        body: "Hi Marina — I found you through the Russian filter. I've been at it for four months and I've hit the wall everyone warns about, which is apparently all six cases at once.",
      },
      {
        from: 'marina',
        id: 'intro-reply',
        body: 'Hello George! Four month is not so long. I am learning English since school but I still afraid to speak with native speaker.',
      },
      {
        from: 'george',
        corrects: 'intro-reply',
        body: "Four months isn't that long. I've been learning English since school but I'm still afraid to speak with native speakers.",
        note: "Three small things: 'four months' takes the plural, 'I am learning since' becomes 'I've been learning since', and 'I still afraid' needs the verb — 'I'm still afraid'.",
        starredBy: 'marina',
      },
      {
        from: 'marina',
        body: "Ah, the 'have been'. In Russian it is just present tense, so my brain refuses.",
      },
      {
        from: 'george',
        id: 'zhivu',
        body: 'Same problem in reverse — I keep saying «я живу здесь два года» and then panicking about whether that is allowed.',
      },
      {
        from: 'marina',
        replyTo: 'zhivu',
        body: 'It is allowed and it is right. You see, you know more than you think.',
        reaction: '👍',
      },
      {
        from: 'george',
        body: 'That is the first encouraging thing anyone has said about my Russian.',
      },
      {
        from: 'marina',
        id: 'why-ru',
        body: 'Why you decided to learn Russian? It is unusual choice for British.',
      },
      {
        from: 'george',
        corrects: 'why-ru',
        body: 'Why did you decide to learn Russian? It is an unusual choice for a British person.',
        note: "Questions in the past need 'did' plus the plain verb: 'why did you decide'. And 'British' is an adjective, so it needs a noun after it — or use 'a Brit'.",
      },
      {
        from: 'george',
        body: 'My grandmother was from Riga and I grew up hearing it in the kitchen without ever learning a word. It started to feel like a debt.',
      },
      {
        from: 'marina',
        body: 'This is beautiful reason. Better than mine — I only wanted better job.',
      },
      {
        from: 'george',
        body: 'Better job is the reason that actually keeps people going, though.',
      },
      {
        from: 'marina',
        body: 'We will see. Good night from Novosibirsk, it is already very late here.',
      },
    ],
  },
  {
    daysAgo: 116,
    at: '20:40',
    turns: [
      {
        from: 'george',
        id: 'coffee-story',
        body: 'Evening. I tried ordering coffee in Russian today at a place in Bristol and the guy answered me in English immediately. Crushing.',
      },
      {
        from: 'marina',
        id: 'coffee',
        replyTo: 'coffee-story',
        body: 'Ha! This is happen to me also in London. But maybe he just want to be helpful, not because your Russian is bad.',
      },
      {
        from: 'george',
        corrects: 'coffee',
        body: 'This happens to me too in London. But maybe he just wanted to be helpful, not because your Russian is bad.',
        note: "'This is happen' → 'this happens'. And once you are telling a story about the past, stay there: 'he just wanted'.",
      },
      { from: 'marina', body: 'Thank you. The -s on the verb is invisible to me, I swear.' },
      {
        from: 'george',
        body: "It's invisible to half of England too. Don't spend your energy on it.",
        reaction: '😂',
      },
      { from: 'george', id: 'rabota', body: 'Let me try one: Я хочу говорить о моя работа.' },
      {
        from: 'marina',
        corrects: 'rabota',
        body: 'Я хочу говорить о своей работе.',
        note: '«о» takes the prepositional case, so работа → работе. And when the thing belongs to the subject, Russian reaches for «своей» before «моей».',
        starredBy: 'george',
      },
      {
        from: 'george',
        replyTo: 'rabota',
        body: 'Two mistakes in six words. That feels about right for month four.',
      },
      { from: 'marina', body: 'Six words is six words. Last month you wrote me only «привет».' },
      { from: 'george', body: 'A devastating and completely accurate point.' },
      { from: 'marina', id: 'what-work', body: 'So tell me — what is your work? You never said.' },
      {
        from: 'george',
        body: 'I write software for a company that makes maps. Mostly arguing about coordinates.',
      },
      {
        from: 'marina',
        replyTo: 'what-work',
        body: 'I am product designer. So we both argue about rectangles all day.',
      },
      { from: 'george', body: 'Different rectangles, same arguing.' },
    ],
  },
  {
    daysAgo: 113,
    at: '08:05',
    turns: [
      {
        from: 'george',
        replyTo: 'rabota',
        body: 'That «своей» is new to me. Is «моей работе» wrong, or only unnatural?',
      },
      {
        from: 'marina',
        body: "Not wrong. A Russian will just hear that you want to stress the work is yours and not somebody else's.",
      },
      { from: 'george', body: "So it's the same instinct as saying 'my own' in English." },
      { from: 'marina', body: 'Yes, exactly this.' },
      { from: 'george', id: 'dacha-ru', body: 'Another one: Я никогда не был в даче.' },
      {
        from: 'marina',
        corrects: 'dacha-ru',
        body: 'Я никогда не был на даче.',
        note: 'На даче, not в даче. Дача is one of the words that takes «на». There is no rule, only a list, and I am sorry.',
        starredBy: 'george',
      },
      { from: 'george', body: 'A list. Wonderful. How long is the list?' },
      { from: 'marina', body: 'Nobody knows. Even we just remember them.' },
      {
        from: 'marina',
        id: 'weekend',
        body: 'What you do in weekend usually? I want to practice small talk, my teacher says it is my weakest.',
      },
      {
        from: 'george',
        corrects: 'weekend',
        body: 'What do you usually do at the weekend?',
        note: "Question word order — 'What do you...'. And it's 'at the weekend' in British English, 'on the weekend' in American. Both are fine.",
      },
      {
        from: 'george',
        replyTo: 'weekend',
        body: "To answer it: I climb badly, I cook slightly better, and I spend far too long reading about things I'll never do.",
      },
      { from: 'marina', body: 'This is very British answer 😄' },
      {
        from: 'marina',
        id: 'dacha',
        body: 'I go to dacha with my parents. Do you have this word in English?',
      },
      {
        from: 'george',
        replyTo: 'dacha',
        body: "We don't, and it always takes me three sentences. 'Country house' sounds far too grand for a shed and some potatoes.",
      },
    ],
  },
  {
    daysAgo: 110,
    at: '21:30',
    turns: [
      {
        from: 'george',
        id: 'film-q',
        body: 'Question. Do you watch films in English with subtitles, and if so, which language?',
      },
      {
        from: 'marina',
        replyTo: 'film-q',
        id: 'subs',
        body: 'English subtitles, always. Without them I understand maybe half. With them I feel like I am reading a book with sound.',
      },
      {
        from: 'george',
        replyTo: 'subs',
        body: 'That is the trap everyone falls into, me included. The eyes take over and the ears stop working.',
      },
      {
        from: 'marina',
        id: 'try-without',
        body: 'So what I should do? Watch without and understand nothing?',
      },
      {
        from: 'george',
        corrects: 'try-without',
        body: 'So what should I do?',
        note: "Word order in questions again: the auxiliary comes before the subject — 'what should I do', not 'what I should do'. It is the same rule as 'what do you usually do'.",
      },
      {
        from: 'george',
        body: 'My honest answer: watch it once with subtitles, then watch one scene again without. Ten minutes, not the whole film.',
      },
      { from: 'marina', body: 'This I can do. Ten minutes is not scary.' },
      { from: 'marina', id: 'rec', body: 'Recommend me something. Not action, I hate explosions.' },
      {
        from: 'george',
        replyTo: 'rec',
        body: 'Paddington 2. I am completely serious — clear speech, gentle jokes, and it is genuinely one of the best films ever made.',
        reaction: '😂',
      },
      { from: 'marina', body: 'You recommend children film to adult woman with master degree.' },
      {
        from: 'george',
        body: "I recommend it to everyone, including people with two master's degrees. Report back.",
      },
      { from: 'george', id: 'ru-film', body: 'Я смотрю фильм каждый вечер. Правильно?' },
      {
        from: 'marina',
        corrects: 'ru-film',
        body: 'Я смотрю фильмы каждый вечер.',
        note: 'If it is every evening then it is more than one film, so plural: фильмы. Your grammar was fine, only the arithmetic was wrong.',
        reaction: '😂',
      },
    ],
  },
  {
    daysAgo: 105,
    at: '07:50',
    turns: [
      {
        from: 'marina',
        id: 'cold',
        body: 'Good morning. Today is minus 27 and my bus did not come. I am writing you from inside a very cold bus stop.',
      },
      {
        from: 'george',
        replyTo: 'cold',
        body: 'Minus twenty-seven. We closed the schools last week for minus two.',
      },
      { from: 'marina', body: 'I know. I saw it in news and I laughed for long time.' },
      {
        from: 'george',
        corrects: 'cold',
        body: 'Today it is minus 27 and my bus never came.',
        note: "Two small ones: English usually wants 'it is' for weather — 'today it is minus 27'. And 'did not come' is fine, but 'never came' is what a native would say about a bus that failed you.",
      },
      { from: 'marina', body: 'Never came. Yes, this bus deserves «never».' },
      {
        from: 'george',
        id: 'how-dress',
        body: 'Genuine question — what do you actually wear at minus 27?',
      },
      {
        from: 'marina',
        replyTo: 'how-dress',
        body: 'Everything. Then one more thing on top of everything.',
        reaction: '🔥',
      },
      { from: 'george', body: 'I am going to remember that sentence for the rest of my life.' },
      {
        from: 'marina',
        id: 'winter-ru',
        body: 'Now you: how to say «it is cold» in Russian, three ways.',
      },
      { from: 'george', id: 'cold-try', body: 'Холодно. Очень холодно. Мне холодный?' },
      {
        from: 'marina',
        corrects: 'cold-try',
        body: 'Холодно. Очень холодно. Мне холодно.',
        note: 'The first two are perfect. The third is the useful one: when you say how *you* feel, Russian uses мне + холодно, not an adjective agreeing with you.',
        starredBy: 'george',
      },
      {
        from: 'george',
        replyTo: 'cold-try',
        body: 'So «мне холодно» is literally "to me it is cold". That is oddly comforting.',
      },
      {
        from: 'marina',
        body: 'Yes! The cold is not your property. It is just happening near you.',
      },
    ],
  },
  {
    daysAgo: 99,
    at: '19:10',
    turns: [
      {
        from: 'george',
        id: 'borscht',
        body: 'I made borscht. I would like to report that it is purple and that I am proud.',
      },
      { from: 'marina', replyTo: 'borscht', body: 'Send photo immediately.' },
      {
        from: 'george',
        body: 'It looks like something a small volcano did. But it tastes correct.',
      },
      {
        from: 'marina',
        id: 'smetana',
        body: 'Did you put smetana? Without smetana it is only soup.',
      },
      {
        from: 'george',
        replyTo: 'smetana',
        body: 'I put crème fraîche because Bristol had no smetana. I assume this is a crime.',
      },
      { from: 'marina', body: 'Small crime. I forgive, because you tried.' },
      {
        from: 'marina',
        id: 'roast',
        body: 'Now teach me British food. But not the one with the meat and the potato and the sad vegetable.',
      },
      {
        from: 'george',
        replyTo: 'roast',
        body: 'You have just described the Sunday roast, which is the entire cuisine. There is nothing else. We stop there.',
        reaction: '😂',
      },
      {
        from: 'marina',
        id: 'cook-en',
        body: 'Okay. Yesterday I am cooking pelmeni for three hours and my kitchen looks like war.',
      },
      {
        from: 'george',
        corrects: 'cook-en',
        body: 'Yesterday I cooked pelmeni for three hours and my kitchen looked like a war zone.',
        note: "'Yesterday I am cooking' → 'yesterday I cooked'. And 'like war' needs something concrete after it in English — 'a war zone', 'a bomb site'. We are strangely specific about our destruction.",
      },
      { from: 'marina', body: 'A bomb site. I will use this every week.' },
      { from: 'george', body: 'That says something worrying about your kitchen.' },
    ],
  },
  {
    daysAgo: 93,
    at: '12:20',
    turns: [
      {
        from: 'george',
        id: 'motion',
        body: 'I have reached verbs of motion and I would like to formally complain.',
      },
      {
        from: 'marina',
        replyTo: 'motion',
        body: 'Ah. Идти and ходить. Welcome to the real Russian.',
      },
      {
        from: 'george',
        id: 'motion-try',
        body: 'Я ходил в магазин вчера и купил хлеб. Is this right?',
      },
      {
        from: 'marina',
        corrects: 'motion-try',
        body: 'Я ходил в магазин вчера и купил хлеб.',
        note: 'Nothing to fix — this is correct, and I am keeping the message so you can see it. Ходил is right here because you went and came back. If you were still there, it would be я пошёл.',
        reaction: '🔥',
      },
      {
        from: 'george',
        replyTo: 'motion-try',
        body: 'Wait. You sent a correction with no correction in it.',
      },
      { from: 'marina', body: 'Yes. Sometimes the lesson is that you were already right.' },
      { from: 'george', body: 'That is either very kind teaching or psychological warfare.' },
      { from: 'marina', id: 'both', body: 'Both is possible.' },
      {
        from: 'george',
        corrects: 'both',
        body: 'Both are possible.',
        note: "'Both' is plural, so it takes 'are'. Tiny, but it is the kind of thing an interviewer notices without knowing why.",
      },
      { from: 'marina', body: 'Both ARE possible. Noted forever.' },
      {
        from: 'george',
        id: 'idti',
        body: 'Okay so: идти is one direction now, ходить is regularly or there and back. Do I have it?',
      },
      {
        from: 'marina',
        replyTo: 'idti',
        body: 'You have it. Now do the same for летать, плавать, бегать and ездить.',
      },
      { from: 'george', body: 'I am going to lie down.' },
      { from: 'marina', body: 'Ложись. That is the verb for it.' },
    ],
  },
  {
    daysAgo: 86,
    at: '22:05',
    turns: [
      { from: 'marina', id: 'music-q', body: 'What music you listen when you work?' },
      {
        from: 'george',
        corrects: 'music-q',
        body: 'What music do you listen to when you work?',
        note: "The 'do' again, and then the preposition: you listen *to* music. English verbs drag prepositions around with them and this is one of the ones that always goes missing.",
      },
      {
        from: 'george',
        replyTo: 'music-q',
        body: 'Anything without words. The moment there are words I start editing them instead of the code.',
      },
      {
        from: 'marina',
        body: 'For me is opposite. I need words, but in language I do not understand.',
      },
      {
        from: 'george',
        id: 'so-english',
        body: 'So English used to be perfect background noise for you and now you have ruined it.',
      },
      {
        from: 'marina',
        replyTo: 'so-english',
        body: 'YES. This is exactly the problem and nobody warned me.',
        reaction: '😂',
      },
      {
        from: 'marina',
        body: 'Now I hear every mistake in every song and I want to correct Ed Sheeran.',
      },
      { from: 'george', body: 'Please do. He has had it coming for years.' },
      {
        from: 'marina',
        id: 'ru-music',
        body: 'I will send you one Russian song. Мне нравится эта песня.',
      },
      {
        from: 'george',
        replyTo: 'ru-music',
        body: 'Мне нравится — that is the same «мне» as «мне холодно». It is happening to me rather than me doing it.',
      },
      {
        from: 'marina',
        body: 'Now you are actually thinking in Russian. This is the moment it starts.',
        reaction: '❤️',
      },
      { from: 'george', body: 'Four months for one moment. I will take it.' },
    ],
  },
  {
    daysAgo: 78,
    at: '08:30',
    turns: [
      {
        from: 'marina',
        id: 'standup',
        body: 'Today I must speak on standup in English. Ten people, all native. I did not sleep.',
      },
      {
        from: 'george',
        corrects: 'standup',
        body: 'Today I have to speak at standup in English. Ten people, all native speakers. I did not sleep.',
        note: "'Must' is fine but sounds like an order you gave yourself; 'have to' is what people say about work. It is 'at standup', and 'natives' on its own reads oddly — 'native speakers'.",
        starredBy: 'marina',
      },
      {
        from: 'george',
        body: 'Also: nobody at a standup is listening. They are all rehearsing their own turn.',
      },
      {
        from: 'marina',
        replyTo: 'standup',
        body: 'This is the most useful thing anyone told me about English.',
      },
      {
        from: 'george',
        id: 'three-lines',
        body: 'Write three lines before it starts. Yesterday, today, blocker. Read them if you freeze.',
      },
      {
        from: 'marina',
        replyTo: 'three-lines',
        body: 'Yesterday, today, blocker. Okay. I can hold three things.',
      },
      { from: 'marina', body: 'I will report after. If I do not write, assume I moved to forest.' },
      { from: 'george', body: 'Assume you moved to *the* forest. Even in disaster, articles.' },
      { from: 'marina', body: '😂 Even in disaster.' },
      {
        from: 'marina',
        id: 'survived',
        body: 'I survived. I said my three lines and one person said "nice one".',
      },
      {
        from: 'george',
        replyTo: 'survived',
        body: 'That is a British standing ovation. You should feel enormous.',
        reaction: '❤️',
      },
      {
        from: 'marina',
        body: 'I felt enormous for about four minutes and then I had another meeting.',
      },
      { from: 'george', body: 'Four minutes is the standard allocation. Spend it well.' },
    ],
  },
  {
    daysAgo: 70,
    at: '20:15',
    turns: [
      {
        from: 'george',
        id: 'phrasal',
        body: 'Tonight, the worst thing in English: phrasal verbs. Give up, give in, give out, give off, give away.',
      },
      {
        from: 'marina',
        replyTo: 'phrasal',
        body: 'Five meanings from one small verb. This is not language, this is cruelty.',
      },
      {
        from: 'george',
        body: 'It gets worse. "Give out" means both to distribute and to stop working.',
      },
      {
        from: 'marina',
        id: 'guess',
        body: 'So if I give out flyers until my legs give out, this is correct sentence?',
      },
      {
        from: 'george',
        corrects: 'guess',
        body: 'So if I give out flyers until my legs give out, that is a correct sentence?',
        note: "The sentence itself is perfect and honestly better than most natives would manage. Only the frame: 'this is correct sentence' → 'that is a correct sentence'.",
        reaction: '🔥',
      },
      {
        from: 'george',
        replyTo: 'guess',
        body: 'You have just made a joke in your third language using the exact ambiguity I was complaining about.',
      },
      { from: 'marina', body: 'Second language. But thank you.' },
      { from: 'george', body: 'Second. Sorry. What is the third?' },
      { from: 'marina', body: 'German, but it left me many years ago and did not leave address.' },
      {
        from: 'george',
        body: 'Didnt leave an address. And the same happened to my French, so I know the feeling exactly.',
        editedTo:
          "Didn't leave an address. And the same happened to my French, so I know the feeling exactly.",
      },
      { from: 'marina', body: 'You corrected yourself. This is new level.' },
      { from: 'george', body: 'I am contractually obliged to be consistent.' },
    ],
  },
  {
    daysAgo: 61,
    at: '13:40',
    turns: [
      {
        from: 'marina',
        id: 'travel',
        body: 'I am thinking about holiday in spring. Maybe Georgia, maybe Armenia. Have you been?',
      },
      {
        from: 'george',
        corrects: 'travel',
        body: 'I am thinking about a holiday in spring. Maybe Georgia, maybe Armenia. Have you been?',
        note: "Just the article: 'a holiday'. Everything else here is exactly right, including 'have you been', which is the tense most learners avoid.",
      },
      {
        from: 'george',
        replyTo: 'travel',
        body: 'Georgia yes, years ago. Tbilisi is the only city that has ever made me consider not coming home.',
      },
      {
        from: 'marina',
        body: 'Everyone says this about Tbilisi. Now I must go and be disappointed personally.',
      },
      {
        from: 'george',
        id: 'visa',
        body: 'Also — this is the useful bit — a British passport is a nightmare to move around with right now, so I mostly travel by looking at photographs.',
      },
      { from: 'marina', replyTo: 'visa', body: 'Welcome to my whole life.' },
      { from: 'george', body: 'Fair. Extremely fair.' },
      {
        from: 'marina',
        id: 'ru-travel',
        body: 'Try in Russian: say that you want to go to Georgia in spring.',
      },
      { from: 'george', id: 'gruzia', body: 'Я хочу поехать в Грузию весной.' },
      {
        from: 'marina',
        corrects: 'gruzia',
        body: 'Я хочу поехать в Грузию весной.',
        note: 'Perfect, including весной, which most learners write as «в весну». Поехать is also the right one — one trip, by transport, not on foot.',
        starredBy: 'george',
      },
      {
        from: 'george',
        replyTo: 'gruzia',
        body: 'I have been saving that sentence for six weeks waiting for a chance to use it.',
      },
      { from: 'marina', body: 'And it was worth it. Весной is the reward.' },
      {
        from: 'marina',
        body: 'Now the same sentence but you go by foot and you live there. Different verb.',
      },
      { from: 'george', body: 'You are enjoying this far too much.' },
    ],
  },
  {
    daysAgo: 50,
    at: '21:00',
    turns: [
      {
        from: 'george',
        id: 'aspect',
        body: 'Right. Aspect. Читал versus прочитал. Explain it to me like I am tired, because I am.',
      },
      {
        from: 'marina',
        replyTo: 'aspect',
        id: 'aspect-answer',
        body: 'Читал is the activity. Прочитал is the finish line. «Я читал книгу» — I was reading. «Я прочитал книгу» — I got to the end and I am proud.',
      },
      {
        from: 'george',
        replyTo: 'aspect-answer',
        body: 'That is the clearest explanation I have had, and I paid a tutor for three of them.',
      },
      {
        from: 'marina',
        body: 'Your tutor probably used the word «perfective» in first minute. This is where they lose people.',
      },
      {
        from: 'george',
        id: 'aspect-try',
        body: 'So: вчера я читал весь вечер, но не прочитал книгу.',
      },
      {
        from: 'marina',
        corrects: 'aspect-try',
        body: 'Вчера я читал весь вечер, но не прочитал книгу.',
        note: 'Correct, and it is exactly the sentence that proves you understand it. Reading happened for hours; finishing did not happen at all.',
        reaction: '🔥',
        starredBy: 'george',
      },
      { from: 'george', body: 'I want that framed.' },
      {
        from: 'marina',
        id: 'en-aspect',
        body: 'English has same problem for me. I read the book, I have read the book, I was reading the book. Three doors, one room.',
      },
      {
        from: 'george',
        corrects: 'en-aspect',
        body: 'English has the same problem for me. I read the book, I have read the book, I was reading the book. Three doors, one room.',
        note: "Only 'the same problem'. And 'three doors, one room' is a better description of English tense than anything in my old textbook.",
        reaction: '❤️',
      },
      { from: 'marina', body: 'Now you know why I am tired also.' },
      { from: 'george', body: 'We should both go to bed and be wrong again tomorrow.' },
      { from: 'marina', body: 'Спокойной ночи, Джордж.' },
    ],
  },
  {
    daysAgo: 41,
    at: '09:25',
    turns: [
      {
        from: 'marina',
        id: 'cat',
        body: 'My cat walked on keyboard and sent my colleague message with only «ффффф». I explained it was cat. They did not believe.',
      },
      {
        from: 'george',
        corrects: 'cat',
        body: 'My cat walked on the keyboard and sent my colleague a message that was just «ффффф». I explained that it was the cat. They did not believe me.',
        note: "Articles on 'the keyboard' and 'the cat', 'sent my colleague a message', and 'believe' wants an object here — 'they did not believe me'. Nothing structural, all furniture.",
      },
      {
        from: 'george',
        replyTo: 'cat',
        body: 'Also every single one of those is an article or a preposition. Your grammar is fine now; you are just fighting the small words.',
      },
      { from: 'marina', body: 'The small words are 90 percent of the war.' },
      {
        from: 'george',
        body: "They are. And they're the last thing to arrive, so it means you're near the end of the hard part.",
      },
      { from: 'marina', id: 'cat-name', body: 'Her name is Груша. It means pear.' },
      {
        from: 'george',
        replyTo: 'cat-name',
        body: 'You named a cat Pear. I have no notes. That is perfect.',
      },
      { from: 'george', body: 'Sorry, ignore that, wrong window.', withdrawn: true },
      { from: 'marina', body: 'What was it? Now I want to know.' },
      {
        from: 'george',
        body: 'It was for the maps argument. You would have found it extremely boring.',
      },
      { from: 'marina', id: 'pear-ru', body: 'Say in Russian: the cat is sleeping on my laptop.' },
      { from: 'george', id: 'cat-try', body: 'Кошка спит на мой ноутбук.' },
      {
        from: 'marina',
        corrects: 'cat-try',
        body: 'Кошка спит на моём ноутбуке.',
        note: 'На with location takes the prepositional: моём ноутбуке. На with direction would take the accusative — that is when the cat *gets onto* the laptop. Right now she is already there and not moving.',
      },
      {
        from: 'george',
        replyTo: 'cat-try',
        body: 'The cat has taught me the prepositional case. Send her my regards.',
      },
    ],
  },
  {
    daysAgo: 30,
    at: '19:45',
    turns: [
      {
        from: 'marina',
        id: 'interview',
        body: 'George, I have interview in English next week. I am very nervous.',
      },
      {
        from: 'george',
        corrects: 'interview',
        body: "I have an interview in English next week. I'm very nervous.",
        note: "Only the article: 'an interview'. Russian does without them and English puts them everywhere — it is still the single most common thing I see from you.",
      },
      { from: 'george', replyTo: 'interview', body: "What's the role?" },
      {
        from: 'marina',
        id: 'role',
        body: 'Product designer, in a company with office in Berlin. All interview will be in English.',
      },
      {
        from: 'george',
        corrects: 'role',
        body: 'Product designer, at a company with an office in Berlin. The whole interview will be in English.',
        note: "'in a company' → 'at a company' when you mean where you work. Then 'an office'. And 'all interview' → 'the whole interview': 'all' doesn't go with a single countable thing.",
      },
      { from: 'marina', body: 'Berlin means they will be non-native too. This helps a little.' },
      {
        from: 'george',
        replyTo: 'role',
        body: 'It helps enormously. Nobody in that room will be a native speaker and everybody will be pretending they are relaxed about it.',
      },
      {
        from: 'marina',
        id: 'practice-ask',
        body: "Can we practice? I will send you my answer for 'tell me about yourself' tomorrow.",
      },
      {
        from: 'george',
        replyTo: 'practice-ask',
        body: "Please do. Send it as a voice message if you're feeling brave — reading it and hearing it are different problems.",
      },
      { from: 'marina', body: 'Tomorrow I will be brave. Today I am tired.', reaction: '❤️' },
      { from: 'george', body: 'Get some sleep. Спокойной ночи.' },
      { from: 'marina', body: 'Твоё произношение уже лучше, чем ты думаешь.' },
      {
        from: 'george',
        body: 'I understood that without a dictionary and I am going to think about it all night.',
      },
    ],
  },
  {
    daysAgo: 19,
    at: '12:30',
    turns: [
      {
        from: 'marina',
        id: 'answer',
        body: 'Okay, here is my answer: I am designer with six years experience. I worked in fintech and now I want to move to more product-driven company.',
      },
      {
        from: 'george',
        corrects: 'answer',
        body: "I'm a designer with six years' experience. I've worked in fintech, and now I want to move to a more product-driven company.",
        note: "'a designer' — English wants an article before a job. 'six years' experience' takes an apostrophe after the s. And 'I've worked' rather than 'I worked', because it still counts today.",
        starredBy: 'marina',
        pinnedBy: 'george',
      },
      {
        from: 'marina',
        replyTo: 'answer',
        body: 'The apostrophe! Nobody told me this in ten years of English.',
      },
      {
        from: 'george',
        body: 'Half of the natives get it wrong too, so it is a free point in an interview.',
      },
      {
        from: 'george',
        body: "Second thing — dont say 'more product-driven company' with a pause in the middle. Say it as one lump.",
        editedTo:
          "Second thing — don't say 'more product-driven company' with a pause in the middle. Say it almost as one word.",
      },
      {
        from: 'marina',
        id: 'hearable',
        body: "And 'six years' experience' when I speak? The apostrophe is not hearable.",
      },
      {
        from: 'george',
        replyTo: 'hearable',
        body: 'It is not, and nobody will catch it out loud. Save it for the written test.',
      },
      {
        from: 'marina',
        id: 'why-leave',
        body: 'Next question they will ask: why you want to leave current job?',
      },
      {
        from: 'george',
        corrects: 'why-leave',
        body: 'Why do you want to leave your current job?',
        note: "The 'do' one more time, and 'your current job' rather than 'current job' — English will not let a singular noun stand there bare.",
      },
      {
        from: 'george',
        body: 'And never answer that one honestly. Say you want more ownership of outcomes. It means nothing and they love it.',
      },
      { from: 'marina', body: 'More ownership of outcomes. I feel dirty but I wrote it down.' },
      { from: 'marina', id: 'calm', body: 'You are very calm teacher.' },
      {
        from: 'george',
        corrects: 'calm',
        body: "You're a very calm teacher.",
        note: "The article again — 'a very calm teacher'. I promise this is the last time I mention it.",
        reaction: '😂',
      },
    ],
  },
  {
    daysAgo: 9,
    at: '20:50',
    turns: [
      {
        from: 'marina',
        id: 'done',
        body: 'It is finished. Fifty minutes. I understood everything and I said maybe eighty percent of what I wanted.',
      },
      {
        from: 'george',
        replyTo: 'done',
        body: 'Eighty percent in a second language under interview pressure is a very high number. What did the other twenty want to say?',
      },
      { from: 'marina', body: 'Something clever about design systems. It stayed in my mouth.' },
      { from: 'george', body: 'It stayed in my mouth is a wonderful phrase and I am adopting it.' },
      { from: 'marina', id: 'wait', body: 'Now I wait one week. This is worst part.' },
      {
        from: 'george',
        corrects: 'wait',
        body: 'Now I wait a week. This is the worst part.',
        note: "'a week' and 'the worst part'. Both are the small words again — and it is worth noticing that under stress those are the first things to go, for everybody, in every language.",
      },
      {
        from: 'marina',
        replyTo: 'wait',
        body: 'Even now you teach. Even when I am dying of waiting.',
      },
      {
        from: 'george',
        body: 'Especially then. It is the only distraction I can offer from this distance.',
      },
      { from: 'marina', body: 'Ignore, wrong person.', withdrawn: true },
      { from: 'marina', body: 'Sorry. Two chats, one thumb.' },
      {
        from: 'george',
        id: 'week-ru',
        body: 'Let me try to say something useful: Всё будет хорошо.',
      },
      { from: 'marina', replyTo: 'week-ru', body: 'Правильно. And also true.', reaction: '❤️' },
    ],
  },
  {
    daysAgo: 2,
    at: '18:15',
    turns: [
      {
        from: 'marina',
        id: 'news',
        body: 'They wrote. They want second call with the design director on Thursday.',
      },
      {
        from: 'george',
        replyTo: 'news',
        body: 'That is not a rejection, that is a shortlist. Very different animal.',
      },
      {
        from: 'marina',
        id: 'director',
        body: 'Design director is British. Now I am nervous in different way.',
      },
      {
        from: 'george',
        corrects: 'director',
        body: 'The design director is British. Now I am nervous in a different way.',
        note: "'The design director', 'in a different way'. You already know both of these — it is nerves, not grammar.",
      },
      {
        from: 'george',
        replyTo: 'director',
        body: 'One practical thing: if a British person says "that is interesting", it can mean anything at all. Do not read it either way.',
      },
      { from: 'marina', body: 'This is terrifying information and I am glad I have it.' },
      {
        from: 'george',
        body: 'Also "not bad" is high praise, and "quite good" is worse than "good". I do not make the rules.',
      },
      { from: 'marina', id: 'quite', body: 'So «quite good» is bad?' },
      {
        from: 'george',
        replyTo: 'quite',
        body: 'In Britain, mildly disappointing. In America, actually good. The same two words.',
      },
      { from: 'marina', body: 'Two doors, one room. I am learning your system.', reaction: '😂' },
      {
        from: 'george',
        body: 'You have started making my jokes back at me and I am not sure how to feel.',
      },
      { from: 'marina', body: 'Feel proud. You built this.' },
    ],
  },
  {
    daysAgo: 1,
    at: '21:15',
    turns: [
      { from: 'marina', id: 'job', body: 'I HAVE THE JOB', reaction: '🔥' },
      { from: 'george', replyTo: 'job', body: 'Congratulations! That was fast.' },
      { from: 'marina', body: "They said my English was 'more than fine'. I nearly cried." },
      {
        from: 'george',
        body: "'More than fine' out of a Berlin startup is basically a standing ovation.",
      },
      {
        from: 'marina',
        replyTo: 'job',
        body: 'And the director said «not bad». So now I know this is good.',
      },
      {
        from: 'george',
        body: 'That is the single best use of everything I have taught you.',
        reaction: '😂',
      },
      { from: 'george', id: 'pozdrav', body: 'Поздравляю с новый работа!' },
      {
        from: 'marina',
        corrects: 'pozdrav',
        body: 'Поздравляю с новой работой!',
        note: 'Here «с» takes the instrumental: новой работой. You will meet this one at every birthday for the rest of your life.',
      },
      {
        from: 'george',
        replyTo: 'pozdrav',
        body: 'Even my congratulations need correcting. This friendship is very efficient.',
      },
      {
        from: 'marina',
        id: 'thanks',
        body: 'I want to say thank you for the corrections. They was really useful.',
      },
      {
        from: 'george',
        corrects: 'thanks',
        body: 'They were really useful.',
        note: "'they was' → 'they were'. Now I really am finished.",
      },
      { from: 'marina', body: '😂 Never stop.' },
    ],
  },
  {
    daysAgo: 0,
    at: '08:40',
    turns: [
      {
        from: 'marina',
        body: 'Доброе утро! Now it is my turn to be the teacher — I wrote you three sentences for homework.',
      },
      {
        from: 'marina',
        body: '1. Вчера я ходил в магазин. 2. Она работает в больнице. 3. Мы будем читать эту книгу.',
      },
      { from: 'marina', body: 'Translate them and I will correct. No dictionary!' },
    ],
  },
]

/** What was written, and when it should look as though it was written. */
interface Sent {
  messageId: ObjectId
  at: Date
}

function scheduleFor(session: Session, turnIndex: number, now: Date): Date {
  const [hour, minute] = session.at.split(':').map(Number)
  const at = new Date(now)
  at.setDate(at.getDate() - session.daysAgo)
  at.setHours(hour ?? 0, minute ?? 0, 0, 0)
  // A couple of minutes between messages: enough that the order is legible in
  // the UI, short enough that a session still reads as one sitting.
  return new Date(at.getTime() + turnIndex * 2 * 60 * 1000)
}

async function playTurn(
  db: Db,
  ids: Record<Side, string>,
  state: { conversationId?: string },
  turn: Turn,
  byTurnId: Map<string, ObjectId>,
): Promise<Message> {
  if (!state.conversationId) {
    const started = await startConversation(db, ids[turn.from], {
      toUserId: ids[other(turn.from)],
      body: turn.body,
    })
    state.conversationId = started.conversation._id.toHexString()
    return started.message
  }

  if (turn.corrects) {
    const target = byTurnId.get(turn.corrects)
    if (!target) throw new Error(`correction points at unknown turn "${turn.corrects}"`)
    const sent = await sendCorrection(db, ids[turn.from], {
      conversationId: state.conversationId,
      targetMessageId: target.toHexString(),
      corrected: turn.body,
      ...(turn.note !== undefined ? { note: turn.note } : {}),
    })
    return sent.message
  }

  const replyTo = turn.replyTo ? byTurnId.get(turn.replyTo) : undefined
  if (turn.replyTo && !replyTo) throw new Error(`reply points at unknown turn "${turn.replyTo}"`)
  const sent = await sendTextMessage(db, ids[turn.from], {
    conversationId: state.conversationId,
    body: turn.body,
    ...(replyTo ? { replyToMessageId: replyTo.toHexString() } : {}),
  })
  return sent.message
}

async function applyExtras(
  db: Db,
  ids: Record<Side, string>,
  conversationId: string,
  turn: Turn,
  message: Message,
): Promise<void> {
  const messageId = message._id.toHexString()

  if (turn.editedTo) {
    await editMessage(db, ids[turn.from], { conversationId, messageId, body: turn.editedTo })
  }
  if (turn.reaction) {
    await reactToMessage(db, ids[other(turn.from)], {
      conversationId,
      messageId,
      emoji: turn.reaction,
    })
  }
  if (turn.starredBy) {
    await starMessage(db, ids[turn.starredBy], { conversationId, messageId, starred: true })
  }
  if (turn.pinnedBy) {
    await pinMessage(db, ids[turn.pinnedBy], { conversationId, messageId })
  }
  // Last, so an edit or a pin above still has a live message to work on — the
  // real mutations refuse both once the tombstone is there, which is the
  // behaviour worth keeping rather than working around.
  if (turn.withdrawn) {
    await deleteMessage(db, ids[turn.from], { conversationId, messageId, scope: 'everyone' })
  }
}

/**
 * Rewrite the timeline so the thread has a past.
 *
 * This is the one place the script hand-writes rather than calling the API's
 * own functions, and it is deliberate: `sendTextMessage` and friends stamp
 * `new Date()`, so a fixture built purely through them is forty-eight messages
 * inside one minute. That has no date separators, no "yesterday", nothing to
 * scroll and no way to tell whether the list is ordered at all.
 *
 * What it does not fix: the token ledger, `dailyActivity` and `streakDays` are
 * left where `awardForSend` put them, at the moment the seed ran. So the
 * balances and the badges are real, and the activity map shows one very busy
 * day rather than seven. Backdating those too would mean reproducing
 * `recordActivity`'s day-keying and the streak's repair rules out here, where
 * they would drift; a chat fixture is not a token fixture, and pretending
 * otherwise is how the two quietly disagree.
 */
async function backdate(db: Db, conversation: Conversation, sent: Sent[]): Promise<void> {
  const messages = db.collection<Message>(COLLECTIONS.messages)
  const byId = new Map(
    (await messages.find({ conversationId: conversation._id }).toArray()).map((message) => [
      message._id.toHexString(),
      message,
    ]),
  )

  // A session scheduled for later today has not happened yet when the seed
  // runs in the morning. Walking backwards from "just before now" pulls any
  // future stamp into the past without disturbing the order of the rest.
  let ceiling = new Date(Date.now() - 5 * 60 * 1000)
  for (const entry of [...sent].reverse()) {
    if (entry.at > ceiling) entry.at = ceiling
    ceiling = new Date(entry.at.getTime() - 90 * 1000)
  }

  const correctedAt = new Map<string, Date>()
  for (const { messageId, at } of sent) {
    const target = byId.get(messageId.toHexString())?.correction?.targetMessageId
    if (target) correctedAt.set(target.toHexString(), at)
  }

  const minutes = (from: Date, count: number): Date => new Date(from.getTime() + count * 60 * 1000)

  await messages.bulkWrite(
    sent.map(({ messageId, at }) => {
      const message = byId.get(messageId.toHexString())
      const set: Record<string, Date> = { createdAt: at }
      // Only what the message already has: `deliveredAt` on a message nobody
      // has received yet would put a second tick on the unread session.
      if (message?.editedAt) set.editedAt = minutes(at, 3)
      if (message?.deletedAt) set.deletedAt = minutes(at, 4)
      if (message?.deliveredAt) set.deliveredAt = new Date(at.getTime() + 30 * 1000)
      if (message?.readAt) set.readAt = minutes(at, 2)
      const corrected = correctedAt.get(messageId.toHexString())
      if (corrected) set.correctedAt = corrected
      return { updateOne: { filter: { _id: messageId }, update: { $set: set } } }
    }),
  )

  const first = sent[0]?.at
  const last = sent[sent.length - 1]?.at
  if (!first || !last) return

  const pinned = conversation.pinned
  const pinnedAt = pinned
    ? sent.find(({ messageId }) => messageId.equals(pinned.messageId))?.at
    : undefined

  await db.collection<Conversation>(COLLECTIONS.conversations).updateOne(
    { _id: conversation._id },
    {
      $set: {
        createdAt: first,
        firstMessageAt: first,
        updatedAt: last,
        'lastMessage.createdAt': last,
        ...(pinnedAt ? { 'pinned.at': minutes(pinnedAt, 1) } : {}),
      },
    },
  )
}

async function seed(db: Db): Promise<void> {
  const ids = {} as Record<Side, string>
  for (const side of Object.keys(CAST) as Side[]) {
    const account = await ensureAccount(db, CAST[side])
    ids[side] = account.userId
    console.log(
      `${account.created ? 'seeded' : 'reused'} ${CAST[side].handle} (${emailFor(CAST[side].handle)})`,
    )
  }

  const existing = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOne({ pairKey: pairKeyFor(ids.george, ids.marina) })
  if (existing) {
    console.log('\nthese two already have a conversation — nothing to do')
    console.log('re-run with --purge first to rebuild it')
    return
  }

  const state: { conversationId?: string } = {}
  const byTurnId = new Map<string, ObjectId>()
  const sent: Sent[] = []
  const now = new Date()

  for (const [index, session] of SESSIONS.entries()) {
    // Everything up to the final session has been seen by both of them; the
    // final one has not, which is what leaves George a badge to open.
    if (index === SESSIONS.length - 1 && state.conversationId) {
      for (const side of Object.keys(CAST) as Side[]) {
        await markConversationRead(db, ids[side], state.conversationId)
      }
    }

    for (const [turnIndex, turn] of session.turns.entries()) {
      const message = await playTurn(db, ids, state, turn, byTurnId)
      if (turn.id) byTurnId.set(turn.id, message._id)
      sent.push({ messageId: message._id, at: scheduleFor(session, turnIndex, now) })
      await applyExtras(db, ids, state.conversationId!, turn, message)
    }
  }

  const conversation = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOne({ _id: new ObjectId(state.conversationId) })
  if (!conversation) throw new Error('conversation vanished mid-seed')

  await backdate(db, conversation, sent)

  const turns = SESSIONS.flatMap((session) => session.turns)
  const corrections = turns.filter((turn) => turn.corrects).length
  const unread = SESSIONS[SESSIONS.length - 1]?.turns.length ?? 0
  console.log(
    `\n${sent.length} messages across ${SESSIONS.length} sittings, ` +
      `${corrections} of them corrections, ${unread} unread for ${CAST.george.displayName}.`,
  )
  console.log(`\nsign in as either, password: ${PASSWORD}`)
  for (const side of Object.keys(CAST) as Side[]) {
    console.log(`  ${emailFor(CAST[side].handle)}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const env = loadEnv()
  const dbName = resolveDbName(args, env.MONGODB_DB)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  console.log(`database: ${dbName}`)

  try {
    if (args.includes('--purge')) await purgeTestAccounts(db)
    else await seed(db)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
