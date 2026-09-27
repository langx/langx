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
  // Travel
  'dreamTrip',
  'bestPlaceVisited',
  'visitorMustSee',
  'travelSurprise',
  // Food
  'comfortFood',
  'dishToTry',
  'breakfast',
  'streetFood',
  // Culture
  'favoriteCelebration',
  'localCustom',
  'childhoodGame',
  'favoriteSong',
  'greetings',
  // Language learning
  'untranslatableWord',
  'whyLearning',
  'hardestPart',
  'favoriteWord',
  'funnyMistake',
  'localSaying',
  // Hobbies
  'freeTime',
  'recentBook',
  'filmToRecommend',
  'newSkill',
  // Work and study
  'whatYouDo',
  'dreamJob',
  'learnedRecently',
] as const

export type ConversationTopic = (typeof CONVERSATION_TOPICS)[number]

/**
 * A conversation whose last message is at least this many days old offers
 * starters again, the same as an empty one. A week: long enough that nobody
 * mid-exchange is shown them, short enough that a thread that has stalled
 * gets a way back in.
 */
export const CONVERSATION_STALE_DAYS = 7
