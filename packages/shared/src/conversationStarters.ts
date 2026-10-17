import type { INTEREST_SUGGESTIONS } from './profile'

/**
 * Conversation starters: the questions a thread offers above its composer when
 * there is nothing to answer — an empty conversation, or one gone quiet.
 *
 * Ids only. The wording is in the app's catalogues (`chat.topics.<id>`), so a
 * topic reads naturally in each of the eight languages rather than as a
 * translation of the English. Grouped by comment, not by type: nothing picks
 * by group, and a second level of structure would only have to be kept in
 * step with the catalogues.
 *
 * Every one is an open question two strangers can both answer, whatever
 * country they are in. Politics, religion and dating are left out on purpose:
 * this is the first thing somebody may say to a person they have never met.
 */
export const CONVERSATION_TOPICS = [
  // Daily life
  'weekendPlans',
  'morningRoutine',
  'favoriteSeason',
  'hometown',
  'perfectDay',
  'morningOrNight',
  'weatherToday',
  'neighborhood',
  'smallJoy',
  // Travel
  'dreamTrip',
  'bestPlaceVisited',
  'visitorMustSee',
  'travelSurprise',
  'nextTrip',
  'travelStyle',
  'souvenir',
  // Food
  'comfortFood',
  'dishToTry',
  'breakfast',
  'streetFood',
  'signatureDish',
  'coffeeOrTea',
  'foreignFood',
  // Culture
  'favoriteCelebration',
  'localCustom',
  'childhoodGame',
  'favoriteSong',
  'greetings',
  'holidayFood',
  'popularSport',
  'childhoodShow',
  'musicLately',
  // Language learning
  'untranslatableWord',
  'whyLearning',
  'hardestPart',
  'favoriteWord',
  'funnyMistake',
  'localSaying',
  'firstPhrase',
  'practiceMethod',
  'hardestSound',
  'slang',
  'tongueTwister',
  'everydayWord',
  // Hobbies
  'freeTime',
  'recentBook',
  'filmToRecommend',
  'newSkill',
  'sportsYouPlay',
  'games',
  'makeThings',
  'channelToRecommend',
  'pets',
  // Work and study
  'whatYouDo',
  'dreamJob',
  'learnedRecently',
  'favoriteSubject',
  'focusTips',
  // Interests — each one the opener for an `INTEREST_SUGGESTIONS` entry no
  // topic above already covered
  'favoriteTeam',
  'stayActive',
  'favoriteArtist',
  'lastPhoto',
  'localHistory',
  'scienceFact',
  'favoriteApp',
  'natureSpot',
  'favoriteAnimal',
  'localStyle',
  'businessIdea',
  'bestTeacher',
  // Just for fun
  'superpower',
  'overnightLanguage',
  'timeTravel',
] as const

export type ConversationTopic = (typeof CONVERSATION_TOPICS)[number]

/**
 * The topics an interest from the onboarding chips points at, so a thread
 * opens with what the other person said they like. Keyed by every suggestion
 * — a chip added there without a line here does not compile. An interest
 * typed as free text matches nothing; it is in whatever language its author
 * wrote it in, and guessing at it would put the wrong question in front of
 * somebody.
 */
export const INTEREST_TOPICS = {
  music: ['favoriteSong', 'musicLately'],
  films: ['filmToRecommend', 'childhoodShow'],
  books: ['recentBook'],
  cooking: ['comfortFood', 'signatureDish', 'dishToTry'],
  travel: ['dreamTrip', 'bestPlaceVisited', 'travelSurprise', 'nextTrip', 'travelStyle'],
  football: ['favoriteTeam', 'popularSport'],
  fitness: ['stayActive', 'sportsYouPlay'],
  gaming: ['games', 'childhoodGame'],
  art: ['favoriteArtist', 'makeThings'],
  photography: ['lastPhoto'],
  history: ['localHistory', 'timeTravel'],
  science: ['scienceFact', 'learnedRecently'],
  technology: ['favoriteApp', 'channelToRecommend'],
  nature: ['natureSpot', 'favoriteSeason'],
  animals: ['favoriteAnimal', 'pets'],
  fashion: ['localStyle'],
  business: ['businessIdea', 'dreamJob'],
  // Listing it as an interest is not an invitation to open with it: the
  // reason politics is left out above holds for this person's partner too.
  politics: [],
  languages: ['untranslatableWord', 'favoriteWord', 'localSaying', 'slang'],
  teaching: ['bestTeacher', 'favoriteSubject'],
} as const satisfies Record<(typeof INTEREST_SUGGESTIONS)[number], readonly ConversationTopic[]>

/**
 * A conversation whose last message is at least this many days old offers
 * starters again, the same as an empty one. A week: long enough that nobody
 * mid-exchange is shown them, short enough that a thread that has stalled
 * gets a way back in.
 */
export const CONVERSATION_STALE_DAYS = 7
