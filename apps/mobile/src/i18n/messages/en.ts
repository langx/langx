/**
 * English — the catalogue every other locale is typed against.
 *
 * Adding a key here without adding it to the seven files beside it is a
 * typecheck failure, which is the point: a screen that silently falls back to
 * English is unreadable to exactly the person it was translated for.
 *
 * Two conventions worth knowing before editing:
 *
 * - A value with a `count` in it is an object of CLDR plural categories, not a
 *   string with a number glued on. English needs `one` and `other`; Russian
 *   and Arabic need more, and a translator can only supply them if the shape
 *   allows it.
 * - Placeholders are `{name}`, substituted by `translate`. Never build a
 *   sentence by concatenating a translated fragment with a value — word order
 *   is not a constant across languages, and the fragment that reads fine after
 *   a number in English lands before it in Turkish.
 *
 * One shape to avoid: a group whose only key is `other`. `Plural` is detected
 * structurally, so such a group would be mistaken for a plural.
 */
export const en = {
  common: {
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    show: 'Show',
    hide: 'Hide',
    /** Without it, for anywhere an icon is already beside the word. */
    backPlain: 'Back',
    clear: 'Clear',
    cancel: 'Cancel',
    ok: 'OK',
    save: 'Save',
    tryAgain: 'Try again',
    retry: 'Try again in a moment.',
    /** The offline banner, and the only place the app says this at all. */
    offline: 'No internet connection',
    checking: 'Checking…',
    oneMoment: 'One moment…',
    skip: 'Skip for now',
    comingSoon: 'COMING SOON',
    continue: 'Continue',
    done: 'Done',
    reset: 'Reset',
    any: 'Any',
    send: 'Send',
    remove: 'Remove',
    block: 'Block',
    report: 'Report',
    edit: 'Edit',
    enable: 'Enable',
    update: 'Update',
  },

  tabs: {
    discover: 'Discover',
    chats: 'Chats',
    echo: 'Echo',
    feed: 'Feed',
    me: 'Me',
  },

  composer: {
    removeAttachment: 'Remove attachment',
    preparingUpload: 'Preparing…',
    uploadingPercent: 'Uploading… {percent}%',
    /*
     * The same two waits, for a 64pt square rather than a chat bubble. The
     * sentence does not fit there: it wraps, and where it wraps changes with
     * the digit count, so the label re-lays-out on every tick and lands on
     * the video badge underneath. A percentage on its own says the same
     * thing and holds still.
     */
    percentOnly: '{percent}%',
    percentPending: '…',
    attachMedia: 'Attach photos or videos',
    attachMenu: 'Attach',
    attachLibrary: 'Photo or video',
    attachCamera: 'Take a photo',
    attachVoice: 'Voice note',
  },

  media: {
    playVideo: 'Play video',
    sourceTitle: 'Add a photo',
    sourceCamera: 'Take a photo',
    sourceLibrary: 'Choose from library',
    cameraTitle: 'Camera',
    cameraPermission: 'LangX needs permission to use your camera.',
  },
  photo: {
    open: 'Open photo',
    close: 'Close photo',
    previous: 'Previous photo',
    next: 'Next photo',
    counter: '{index} / {total}',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Couldn’t save it',
    saveDenied:
      'LangX needs permission to add photos and videos to your library. You can allow it in Settings.',
  },
  tips: {
    composerCorrect: 'Hold a message to correct it',
    composerReply: 'Swipe a message to reply',
    composerStar: 'Hold to star or translate',
    composerVoice: 'Tap the mic, hear it back, then send',
    chatStar: 'Hold a message and choose Star to keep it somewhere you can find it again.',
    chatTranslate: 'Hold a message to translate it, without leaving the conversation.',
    chatVoice:
      'Tap the microphone for a voice note — you can play it back before you send it, and hearing a word is half of learning it.',
    chatsSwipe: 'Swipe a chat sideways to pin or archive it.',
    chatsPin: 'Pin the chats you come back to and they stay at the top.',
    chatsUnreplied: 'The Unreplied tab is everyone still waiting on you.',
    discoverRadius: 'Nearby goes from closest outwards. Set a radius in the filters to stop it.',
    discoverSearch: 'Looking for someone in particular? Search their handle.',
    feedCorrect: 'Fixing one sentence takes a moment and is the most useful thing you can do here.',
    feedPronounce: 'Cannot say a word? Ask, and someone will record it for you.',
    dismiss: 'Dismiss this tip',
    section: 'Tips',
    show: 'Show tips',
    showBody:
      'Short hints while you learn your way around. Turning them back on brings the dismissed ones back.',
    chatCorrect:
      'Hold any message to correct it — corrections are the most useful thing you can send.',
    chatSwipeReply: 'Swipe a message to the right to reply to it.',
    discoverFilters: 'Use the filters to narrow by level, age or country.',
    feedAsk: 'Stuck on a sentence? Post it here and someone will fix it.',
    chatEcho:
      'Hold a message and choose Add echo. It comes back tomorrow, then in three days, then in a week.',
    chatAttach:
      'The + beside the composer can ask for a correction, propose a time to talk, or send a quiz.',
    chatsStarred: 'The star in the header opens every message you have starred, from every chat.',
    discoverActive: 'Sort by Active to see who has been around lately.',
    feedEcho: 'Hold a post to keep its sentence in Echo.',
    feedSlowTake:
      'Answering a pronunciation ask? Add a slow take too — that is the one people learn from.',
    composerEcho: 'Hold a message to keep it in Echo',
    echoAgain: 'Forgot one? Tap Again and it comes back in ten minutes, not days. Nothing is lost.',
    echoAutoplay:
      'The speaker in the session header plays each card as it appears. Tap it to turn that off.',
    echoTyping:
      'Once a card has settled in, every other review asks you to write it rather than just recall it.',
    echoArchive:
      'Know a card cold? Archive it from All cards. It keeps everything and stops coming back.',
    echoOwn:
      'Write a card of your own from All cards. Leave the meaning empty and it is translated for you.',
    echoRecord: 'Open a card to add a picture, or to record it in your own voice.',
  },
  tour: {
    announcement: '{title}. {body}',
    progress: 'Step {current} of {total}',
    next: 'Next',
    done: 'Got it',
    skip: 'Skip',
    discoverPairTitle: 'Matched both ways',
    discoverPairBody:
      'Everyone on this screen speaks the language you are learning and is learning one you speak. Tap the pair to change it.',
    discoverSortsTitle: 'Three ways to look',
    discoverSortsBody:
      'For you is matched to your languages, Active is who has just been here, and Nearby uses your location once you share it.',
    discoverCardTitle: 'Start here',
    discoverCardBody:
      'Open anyone to read their profile. Saying hello first is how almost every exchange on LangX begins.',
    tabChatsTitle: 'Where replies land',
    tabEchoTitle: 'Echo',
    tabEchoBody: 'Keep a sentence from any chat and it comes back until you know it.',
    tabChatsBody:
      'Every conversation you start lives here, and the ones still waiting on you sit in their own tab.',
    tabChatsGuestBody:
      'Conversations live here. You can read and browse without an account — messaging is the one thing that needs one.',
    tabFeedTitle: 'Ask and learn',
    tabFeedBody:
      'The Feed is the whole room: get a sentence corrected, hear how a word is said, and do the same for someone else.',
  },
  theme: {
    section: 'Appearance',
    label: 'Theme',
    light: 'Light',
    dark: 'Dark',
    autoSystem: 'Auto (system)',
  },

  messageActions: {
    reply: 'Reply',
    correct: 'Correct',
    translate: 'Translate',
    speak: 'Read aloud',
    copy: 'Copy',
    delete: 'Delete',
    edit: 'Edit',
    star: 'Star',
    unstar: 'Unstar',
    pin: 'Pin',
    unpin: 'Unpin',
    report: 'Report',
    correctedCannotEdit: 'Corrected — can’t be edited',
    share: 'Share',
    savePhrase: 'Save as a phrase',
    saveMedia: 'Save to device',
    echo: 'Add to Echo',
    unecho: 'Remove from Echo',
  },

  /**
   * Echo — the review tab.
   *
   * Nothing on a *card* is here. A card's front, back and example are a
   * sentence somebody said in French or Russian, and they are data: they
   * never pass through `t()` and they are never translated into the eight.
   */
  echo: {
    title: 'Echo',
    due: { one: '{count} card due', other: '{count} cards due' },
    allCaughtUp: 'Nothing due right now',
    review: 'Review',
    allLanguages: 'All',

    // Capture: from a chat bubble, from a post, or written by hand.
    added: 'Added to Echo',
    alreadyAdded: 'Already in Echo',
    removed: 'Removed from Echo',
    addToEcho: 'Add echo',
    removeFromEcho: 'Remove from Echo',
    /** The chip at the end of a translation line, where the word is met. */
    bubbleAdd: '+ Echo',
    bubbleAdded: 'In Echo',
    addFailedTitle: 'Could not add this card',
    removeFailedTitle: 'Could not remove this card',
    /**
     * A ceiling, not a paywall — the number is the same on every plan, so
     * this alert offers nothing to buy and must never open the upgrade screen.
     */
    limitTitle: 'Daily Echo limit reached',
    limitBody: 'You can keep {count} cards a day. It resets tomorrow.',

    // The tab.
    fromYourChats: 'From your chats',
    fromAPost: 'From a post',
    fromYourself: 'Written by you',
    seeAllCards: 'See all cards',
    emptyTitle: 'Nothing to review yet',
    emptyBody:
      'Press and hold a message in a chat, then choose Add to Echo. It comes back tomorrow, then in three days, then in a week.',
    emptyAction: 'Go to Chats',

    // The tab, drawn as a stage: the tile in the middle is the button, and
    // every list it used to carry is a row at the bottom.
    readyTitle: 'Ready when you are',
    /** Under the number on the tile, uppercase, so the two read as one. */
    tileDue: 'cards due',
    readySub: 'Tap to start reviewing',
    /** `{time}` is already short — `3h`, `4d`. */
    nextIn: 'The next card comes back in {time}',
    statToday: 'Today',
    statWeek: 'This week',
    statCards: 'Cards',
    allCards: 'All cards',
    allCardsSub: 'From your chats, from posts, and your own',
    leaderboard: 'Leaderboard',
    leaderboardSub: 'Who has answered the most cards',
    packsSub: 'Ready-made words for what you are learning',
    packsBlurb:
      'Ready-made words for the languages you are learning. Take a handful and they join the same schedule as the cards you keep yourself.',
    packsEmptyTitle: 'No packs yet',
    packsEmptyBody:
      'Packs follow the languages you are learning. Add one to your profile and whatever we have for it turns up here.',
    /** Under the number on the pack's tile, so the two read as one line. */
    packTileSub: 'of {total} started',
    statWords: 'Words',
    statYours: 'Yours',
    statReviews: 'Reviews',
    cardSource: 'Where it came from',
    removeCard: 'Remove card',

    // Every card.
    cards: 'Cards',
    cardCount: { one: '{count} card', other: '{count} cards' },
    cardsEmptyTitle: 'No cards yet',
    cardsEmptyBody:
      'Sentences you keep from chats and posts collect here, along with the ones you write yourself.',
    /** Not "delete": the card stays, with its recordings and its schedule. */
    archiveCard: 'Archive this card',
    archiveCards: 'Archive',
    unarchive: 'Put it back',
    activeTab: 'Cards',
    archived: 'Archived',
    archivedEmptyTitle: 'Nothing archived yet',
    archivedEmptyBody:
      'Cards you already know go here. They keep everything and stop coming back, until you put one back.',
    selectCards: 'Select cards',
    selectedCount: { one: '{count} selected', other: '{count} selected' },
    archivedToast: { one: '{count} card archived', other: '{count} cards archived' },
    restoredToast: { one: '{count} card is back', other: '{count} cards are back' },
    searchPlaceholder: 'Search your cards',
    searchNoneTitle: 'Nothing matches',
    searchNoneBody: 'No card has that in its sentence, its meaning or its example.',
    /** When the card comes back. `{time}` is already short: `10m`, `4d`. */
    dueIn: 'Due in {time}',
    dueNow: 'Due now',
    remove: 'Remove',
    removeTitle: 'Remove this card?',
    removeBody: 'Its schedule goes with it. The message itself stays where it is.',
    editTitle: 'Edit card',
    editFront: 'Sentence',
    editBack: 'What it means',
    edited: 'Card updated',
    editFailedTitle: 'Could not save this card',
    cardMenu: 'Card options',
    newTitle: 'New card',
    cardLanguage: 'Language',
    backHint: 'Leave the meaning empty and it will be translated for you.',
    reviewWhich: 'Which language?',
    cardPhoto: 'Picture',
    addPhoto: 'Add a picture',
    replacePhoto: 'Replace the picture',
    removePhoto: 'Remove the picture',
    cardAudio: 'Recording',
    recordIt: 'Say it yourself',
    removeAudio: 'Remove the recording',

    // The session.
    sessionProgress: '{done} of {total}',
    show: 'Show answer',
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy',
    play: 'Play',
    /**
     * One button under the takes, repeating whichever was pressed last.
     * A card can hold three — a person's recording and two synthesised
     * readings — and finding the one just heard among them is what this
     * saves. Same words as `chat.playAgain`, which is the same act.
     */
    playAgain: 'Play again',
    /** So a recording by a person is never mistaken for anything else. */
    /* A machine reading, and the label says so — there is nobody to credit. */
    /* Over the rows a pack would add next, under its Start button. */
    packNext: 'Up next',
    /**
     * The switch in the session header. The label is the state, because
     * that is what a screen reader wants from a switch: the icon says it to
     * everybody else.
     */
    autoplayOn: 'Autoplay on',
    autoplayOff: 'Autoplay off',
    voiceFemale: 'Synthesised · female',
    voiceMale: 'Synthesised · male',
    voiceSynthesised: 'Synthesised',
    /** The server voice, on a card of the member's own. */
    readAloud: 'Read it aloud',
    readAloudFailedTitle: 'Could not read this card aloud',
    readAloudLimitBody: 'You can have {count} cards read aloud a day. It resets tomorrow.',
    spokenBy: 'Spoken by {name}',
    /** Names the feed, because the post is public and the chat one was not. */
    askToHearIt: 'Ask the feed how it is said',
    /** On an answer, when the card that asked has no recording yet. */
    keepOnCard: 'Keep on my card',
    /** On an answer already kept: said, not offered, so nothing is greyed out. */
    audioAlreadyKept: 'On your card',
    audioKept: 'Kept on your card',
    /** Names the feed, as the pronunciation one does. */
    askForCorrection: 'Ask the feed to correct it',
    /** On a correction, when the card that asked is the viewer's own. */
    keepCorrection: 'Keep this as my sentence',
    correctionKept: 'Your card now says this',
    seeCard: 'See the card',
    cardTitle: 'Card',
    nextReview: 'Next review',
    sessionEmptyTitle: 'Nothing due',
    sessionEmptyBody: 'Come back later, or keep a sentence from one of your chats.',
    doneTitle: 'Session complete',
    doneReviewed: 'Reviewed',
    doneRemembered: 'Remembered',
    doneAgain: 'Again',
    doneBody: 'Echo brings these back when they are due.',
    saveFailedTitle: 'Your review did not save',
    saveFailedBody: 'Your answers are still here. Try again.',
    offlineSession: 'Offline. Your answers are saved and sent when you are back.',
    packs: 'Packs',
    packsFor: 'Start from a pack',
    packBlurb:
      'A curated set to start from. Every card joins the same queue as the ones you keep yourself.',
    packStart: 'Start',
    packContinue: 'Continue',
    packAllStarted: 'All started',
    packMissing: 'This pack is no longer available.',
    packFinished: 'Every card in this pack is already yours.',
    packStarted: {
      one: '{count} card added',
      other: '{count} cards added',
    },
    packProgress: '{done} of {total} started',
    /** A Chinese pack's name: the HSK level it is, which is how learners measure themselves. */
    packHsk: 'HSK {level}',
    producePrompt: 'Write it in {language}',
    produceHint: 'Type the phrase',
    check: 'Check',
    yourAnswer: 'You wrote',
    verdictExact: 'Exactly right',
    verdictClose: 'Right, give or take an accent',
    verdictWrong: 'Not quite',
    /*
     * "What is this?" in the header, and what it opens.
     *
     * The intervals named here are the real ladder a card climbs on Good —
     * `SRS_RULES`' two learning steps, then 1, 3, 8, 20, 50, 125 and 313 days
     * against a 365-day ceiling — and not a rounder set that would read
     * better: the session draws the same numbers on its grade buttons, and an
     * explainer that disagreed with them would be teaching the wrong thing
     * about the screen it sits on.
     *
     * The row names the first five and then `aboutStepMore` says the rest in
     * words, because five numbers on their own read as "five reviews and then
     * it is over". Nothing is ever over: a card has no retired state, and at
     * the top of the ladder it still comes back about once a year.
     *
     * The claim in `aboutProof` is deliberately the narrow one. Spacing and
     * retrieval practice are what a century of memory research actually
     * supports; "the best way to learn a language" is not, and writing it
     * would be a promise the schedule cannot keep.
     */
    aboutOpen: 'What is this?',
    aboutTitle: 'How Echo works',
    aboutBody:
      'Echo brings a sentence back just before you would forget it. Remember it, and the next wait is longer.',
    aboutWithout: 'Without review',
    aboutWith: 'With Echo',
    aboutChart:
      'Two lines over one week. Without review, what you remember falls away to almost nothing. With Echo, each review lifts it back and the falling gets slower every time.',
    aboutLadder: 'The waits are real',
    aboutStep10m: '10 minutes',
    aboutStep1d: '1 day',
    aboutStep3d: '3 days',
    aboutStep8d: '8 days',
    aboutStep20d: '20 days',
    aboutStepMore: 'then months, then once a year',
    aboutRecall: 'Being asked beats reading it again.',
    aboutLittle: 'Ten minutes a day beats an hour once a week.',
    aboutYours: 'Your own sentences, out of your own chats.',
    aboutForgot: 'Forget one and it comes back sooner. Nothing is lost.',
    aboutProof:
      'Spacing and self-testing: the two best-proven findings in memory research, since the 1880s.',
    aboutClose: 'Got it',
  },

  messageMeta: {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    edited: 'Edited',
    you: 'You',
    attachment: 'Attachment',
    photo: 'Photo',
    message: 'Message',
    sending: 'Sending',
    video: 'Video',
    sticker: 'Sticker',
    phrase: 'Phrase',
    meeting: 'Meeting',
    quiz: 'Quiz',
    correction: 'Correction',
  },

  /**
   * The suggestion chips. Stored as the slug, shown in the reader's language —
   * so two people with the same interest still match on `music` whatever their
   * screens say. An interest with no entry here falls back to its slug, which
   * is what a profile carrying an older suggestion will show.
   */
  interests: {
    music: 'Music',
    films: 'Films',
    books: 'Books',
    cooking: 'Cooking',
    travel: 'Travel',
    football: 'Football',
    fitness: 'Fitness',
    gaming: 'Gaming',
    art: 'Art',
    photography: 'Photography',
    history: 'History',
    science: 'Science',
    technology: 'Technology',
    nature: 'Nature',
    animals: 'Animals',
    fashion: 'Fashion',
    business: 'Business',
    politics: 'Politics',
    languages: 'Languages',
    teaching: 'Teaching',
  },

  gender: {
    female: 'Female',
    male: 'Male',
    other: 'Non-binary / other',
    shortOther: 'Non-binary',
    undisclosed: 'Prefer not to say',
  },

  level: {
    absoluteBeginner: 'Absolute beginner',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    fluent: 'Fluent',
    shortAbsoluteBeginner: 'New',
    shortBeginner: 'Beginner',
    shortIntermediate: 'Intermediate',
    shortFluent: 'Fluent',
  },

  period: {
    all: 'All time',
    year: 'This year',
    month: 'This month',
    week: 'This week',
  },

  /**
   * Ages and durations. Separate from `common` because these are the entries
   * most likely to need a plural category English does not have.
   */
  format: {
    now: 'now',
    minutes: '{count} min',
    hours: '{count} h',
    daysShort: '{count} d',
    minutesCompact: '{count}m',
    hoursCompact: '{count}h',
    daysCompact: '{count}d',
    days: { one: '{count} day', other: '{count} days' },
    messages: { one: '{count} message', other: '{count} messages' },
    corrections: { one: '{count} correction', other: '{count} corrections' },
    accountAgeToday: 'today',
    accountAgeDays: { one: '{count} day ago', other: '{count} days ago' },
    accountAgeMonths: { one: '{count} month ago', other: '{count} months ago' },
    accountAgeYears: { one: '{count} year ago', other: '{count} years ago' },
  },

  errors: {
    signInFailed: 'Sign in failed',
    signUpFailed: 'Sign up failed',
    googleSignInFailed: 'Google sign-in failed',
    appleSignInFailed: 'Apple sign-in failed',
    facebookSignInFailed: 'Facebook sign-in failed',
    discordSignInFailed: 'Discord sign-in failed',
    resetFailed: 'Could not reset password',
    invalidCredentials:
      'That does not match an account. Sign in with your email or username — or email yourself a sign-in link, which also works if you had an account in the previous app. Google and Apple work too.',
    attachmentUnsupported:
      'That format isn’t supported. Use a JPEG, PNG or WebP image, or an MP4 or MOV video.',
    attachmentTooLarge: 'That file is too large to send.',
    videoTooLong: {
      one: 'Videos can be up to one second long.',
      other: 'Videos can be up to {count} seconds long.',
    },
    tooManyAttachments: {
      one: 'You can attach one file.',
      other: 'You can attach up to {count} files.',
    },
    userExists:
      'An account already exists for that email. Sign in, email yourself a sign-in link, reset your password, or continue with Google or Apple.',
    emailNotVerified: 'Verify your email address first — check your inbox.',
    passwordTooShort: 'That password is too short.',
    invalidEmail: 'That does not look like an email address.',
    invalidToken: 'That link is no longer valid.',
    uploadFailed: 'Upload failed',
    loadFailed: 'Could not load this. Check your connection and try again.',
    /** A write that never reached a server: the one failure the reader can place. */
    offlineAction: 'That didn’t go through — you’re offline.',
    actionFailed: 'That didn’t go through. Try again.',
  },

  location: {
    useMyLocation: 'Use my location',
    deniedTitle: 'Location is off for LangX',
    openSettings: 'Open settings',
    failedTitle: 'Could not read your location',
    noCountry: 'We could not tell which country that is.',
    countryUpdated: 'Country updated.',
    denied: 'LangX needs location permission to do this. You can grant it in your device settings.',
    disabled: 'Location services are turned off on this device.',
    unavailable: 'Could not get a location right now. Try again in a moment.',
    unavailableTitle: 'Location unavailable',
    /**
     * The guide screen, which is the one place the instructions live. Discover
     * and the alerts name the reason and link here rather than repeating the
     * steps: an iOS path, an Android path, a device-wide switch and a browser
     * that has none of them is four sets of words, and four copied into three
     * screens drift apart on the first change.
     */
    guide: {
      title: 'Location permission',
      rowTitle: 'Location permission',
      rowBody: 'Where to turn it on, and what to do if your phone stopped asking.',
      grantedTitle: 'Location is on',
      grantedBody:
        'LangX can read a rough position while you are using it. You can take that back in your device settings whenever you like.',
      askableTitle: 'LangX needs your location',
      askableBody:
        'Nearby sorts people by roughly how far away they are. Nothing precise is stored, and nobody sees more than a rough distance.',
      allow: 'Allow location',
      blockedTitle: 'Your device will not ask again',
      blockedBody:
        'Location was declined for LangX, so the app can no longer bring up the permission dialog. You can still grant it in your device settings.',
      iosStep1: 'Open Settings',
      iosStep2: 'Find LangX in the list',
      iosStep3: 'Tap Location and choose “While Using the App”',
      androidStep1: 'Open Settings',
      androidStep2: 'Go to Apps → LangX',
      androidStep3: 'Tap Permissions → Location',
      androidStep4: 'Choose “Allow only while using the app”',
      servicesOffTitle: 'Location is off on this device',
      servicesOffBodyIos:
        'LangX has permission, but Location Services is switched off for the whole phone. Turn it back on in Settings → Privacy & Security → Location Services.',
      servicesOffBodyAndroid:
        'LangX has permission, but location is switched off for the whole device. Turn it back on in Settings → Location.',
      webTitle: 'Your browser decides this one',
      webBody:
        'Location permission belongs to the browser here, not to LangX. Look for the location icon in the address bar, or allow location in this site’s settings.',
      howTo: 'How to turn it on',
    },
  },

  /**
   * The screen a suspended account gets instead of the app.
   *
   * Never names who reported them — nothing in the product does, and this is
   * the screen where the temptation would be greatest.
   */
  suspended: {
    title: 'Your account is suspended',
    untilBody:
      'A report about your account was reviewed by a person. You cannot use LangX until {until}, and your profile is hidden from Discover and search.',
    permanentBody:
      'A report about your account was reviewed by a person, and your account is suspended permanently. Your profile is hidden from Discover and search.',
    reasonLabel: 'Reason',
    appealTitle: 'Appeal',
    appealBody:
      'You can appeal once. A person reads every appeal, and there is no queue to watch — the answer arrives by email.',
    appealPlaceholder: 'Tell us what we got wrong.',
    appealTooShort: {
      one: 'At least {count} character.',
      other: 'At least {count} characters.',
    },
    send: 'Send appeal',
    sending: 'Sending…',
    sent: 'Appeal sent',
    sentBody:
      'Your appeal has been sent. There is one per suspension, so this was it — we will write back.',
    failed: 'That could not be sent. Try again in a moment.',
    alreadyAppealed: 'You have already appealed this suspension.',
    checkAgain: 'Check again',
    signOut: 'Sign out',
    contact: 'Anything else: {email}',
  },

  gate: {
    maintenanceTitle: 'Back shortly',
    maintenanceBody: 'LangX is briefly unavailable while we finish some work.',
    maintenanceUntil: '{message}\n\nExpected back: {until}',
    updateTitle: 'Update to continue',
    updateBody:
      'This version of LangX is no longer supported. Update to the latest one to keep using it.',
  },

  /**
   * The soft side of the version story: an over-the-air update that has landed
   * in the background, and a store release newer than this build. `gate.*` is
   * the hard side — the screen that stops a build too old to run at all.
   */
  update: {
    downloaded: 'A new version is ready.',
    restart: 'Restart now',
    bannerTitle: 'A new version is out',
    bannerBody: 'Update to get the latest LangX.',
    dismiss: 'Dismiss',
  },

  intro: {
    slide1Title: 'Speak yours, practise theirs',
    slide1Body:
      'Everyone here is native in a language you are learning, and learning one you already speak. That is the only way you get matched.',
    slide2Title: 'Correct, and be corrected',
    slide2Body:
      'Fix someone’s sentence and they see exactly what changed. Corrections are unlimited on every plan — teaching is the point.',
    slide3Title: 'Show up, and it adds up',
    slide3Body:
      'One message a day keeps your streak alive. Earn tokens for talking and teaching, and spend them on a streak freeze or a look for your profile.',
    getStarted: 'Get started',
    skip: 'Skip',
    next: 'Next',
    done: 'Done',
    correctionFrom: 'Correction from a partner',
    correctionBefore: 'I am agree with you.',
    correctionAfter: 'I agree with you.',
  },

  welcome: {
    title: 'Practise with someone who is learning yours',
    subtitle:
      'Have a look first — you can pick your languages and see who is here before you sign up for anything.',
    browse: 'Look around first',
    line2: 'Correct and be corrected',
    line3: 'Show up daily and it adds up',
    /** Screen-reader name for the row of example exchanges. */
    pairsLabel: 'Language exchanges',
    createAccount: 'Create an account',
    haveAccount: 'I already have an account',
    guestFailed: 'Could not start',
  },
  auth: {
    confirmPassword: 'Confirm password',
    passwordsDoNotMatch: 'The two passwords are different.',
    passwordTooShort: 'At least {min} characters.',
    passwordRule: 'At least {min} characters',
    welcomeBackSubtitle: 'Sign in to pick up where you left off.',
    resetBody: "Enter the email you signed up with and we'll send you a reset link.",
    welcomeBack: 'Welcome back',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    signingIn: 'Signing you in…',
    signUp: 'Sign up',
    continueWithGoogle: 'Continue with Google',
    continueWithApple: 'Continue with Apple',
    continueWithFacebook: 'Continue with Facebook',
    continueWithDiscord: 'Continue with Discord',
    emailOrHandle: 'Email or username',
    or: 'or',
    noAccount: 'Don’t have an account? ',
    justLooking: 'Just looking?',
    haveAccount: 'Already have an account? ',
    createAccount: 'Create your account',
    minimumAge: 'You must be {age}+ to use LangX.',
    acceptTerms: 'I have read and agree to the',
    acceptTermsAnd: ' and the ',
    acceptTermsLabel: 'Terms and privacy policy',
    backToSignIn: 'Back to sign in',
    goToSignIn: 'Go to sign in',
    checkEmailTitle: 'Check your email',
    checkEmailBody:
      'We sent a verification link to\n{email}\n\nTap it and the app opens, signed in.',
    resendEmail: 'Resend email',
    resent: 'Sent — resend again',
    resetTitle: 'Reset your password',
    sendResetLink: 'Send reset link',
    resetSentBody: 'If an account exists for {email}, a reset link is on its way.',
    linkExpiredTitle: 'Link expired',
    linkExpiredBody:
      'This reset link is no longer valid. Request a new one from the sign-in screen.',
    requestNewLink: 'Request a new link',
    signInWithLink: 'Email me a sign-in link',
    signInLinkTitle: 'Sign in with a link',
    signInLinkBody:
      'Enter your email or username and we will send you a link that signs you in — no password needed.',
    sendSignInLink: 'Send sign-in link',
    signInLinkSentBody:
      'If an account exists for {email}, a sign-in link is on its way. It works once and expires in 15 minutes.',
    signInLinkExpiredBody:
      'That sign-in link has already been used or has expired. Ask for a new one and tap it within 15 minutes.',
    openLinkTitle: 'Sign in to LangX',
    openLinkBody:
      'You followed a sign-in link. Tap the button to finish signing in on this device.',
    openLinkButton: 'Sign in',
    openInApp: 'Open in the LangX app',
    verifyLinkTitle: 'Confirm your email',
    verifyLinkBody:
      'You followed a verification link. Tap the button to finish setting up your account on this device.',
    verifyLinkButton: 'Confirm email',
    verifying: 'Confirming your email…',
    setNewPassword: 'Set a new password',
    newPassword: 'New password',
    updatePassword: 'Update password',
    verifiedTitle: 'Email verified',
    verifiedBody: 'You can sign in now.',
    verificationFailedTitle: 'Verification failed',
    verificationFailedBody: 'That link is invalid or has expired. Sign in and request a new one.',
    signInWithCode: 'Sign in with a code from another device',
    signInLinkNote:
      'It works once and expires in 15 minutes. It also works if you had an account in the previous app.',
  },

  onboarding: {
    stepOf: 'Step {step} of {total}',
    levelsTitle: 'How far along are you?',
    levelsBody: '1 is an absolute beginner, 4 is fluent.',
    pickALevel: 'Choose a level',
    birthDate: 'Date of birth',
    birthDatePlaceholder: 'Choose a date',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    languagesTitle: 'Which languages do you speak?',
    languagesBody:
      'Your native language is what you can teach; what you’re learning is who you’ll match with.',
    native: 'Native',
    learning: 'Learning',
    upToCount: { one: 'Up to {count}', other: 'Up to {count}' },
    cannotBeBoth: 'A language can’t be both',
    aboutYouBody: 'Just the basics — you can change all of this later.',
    aboutYouTitle: 'About you',
    displayName: 'Display name',
    aboutYouOptional: 'About you (optional)',
    tooYoung: 'LangX is for people aged {age} and over.',
    photoTitle: 'Put a face to it',
    photoBody:
      'We drew you a face. A real photo makes people far more likely to say hello — and the bio is optional too.',
    drawnFace: 'Drawn for you. It stays until a photo replaces it.',
    photoUnavailable: 'Photos unavailable',
    photoPermission: 'LangX needs access to your photos to set a picture.',
    photoUploadFailed: 'That picture did not upload. You can try again or skip.',
    addPhoto: 'Add a photo',
    changePhoto: 'Change photo',
    uploading: 'Uploading…',
    bioPrompt: 'Something for a stranger to open with.',
    username: 'Username',
    namePlaceholder: 'Alex',
    gender: 'Gender',
    handleBody: 'Letters, numbers and underscores. This is how people find you.',
    handleTitle: 'Choose a username',
    handlePlaceholder: 'alex',
    handleReserved: '@{handle} is reserved for you',
    handleReservedBody: 'Your username from the old LangX. You can claim it back, once.',
    handleAvailable: '@{handle} is available ✓',
    handleTaken: '@{handle} is taken',
    handleCheckFailed: 'Could not check that username. Tap to try again.',
    startUsing: 'Start using LangX',
    profileFailed: 'Could not create your profile. Try again.',
    doneTitle: 'You’re in',
    doneHandle: '@{handle} is yours.',
    doneReady: 'Your profile is ready.',
    whatNext: 'What happens next',
    whatNextBody:
      'Discover shows people who speak what you are learning. Say hello to one of them.',
    findSomeone: 'Find someone to talk to',
    sayHelloTo: 'Say hello to {name}',
    inviteCodeToggle: 'Have an invite code?',
    inviteCodeLabel: 'Invite code',
    inviteCodePlaceholder: 'their username',
    inviteCodeFound: 'You were invited by {name}.',
    inviteCodeUnknown: 'We could not find that one — you can continue anyway.',
    genderNotSaying: 'Not saying',
    genderNote:
      'Choosing “{option}” keeps you out of gender-filtered searches. You can set this once.',
  },

  welcomeBack: {
    restoringTitle: 'Restoring your profile',
    restoringBody:
      'Your LangX account is coming back — your languages, your photos and your streak. This can take a moment; please stay on this screen.',
    startExploring: 'Start exploring',
    title: 'Welcome back',
    subtitle: 'Here is what came with you.',
    handleTitle: '@{handle}',
    handleBody: 'Your username is yours again — nobody else could claim it.',
    handleBodyChoose:
      'The old LangX named you this. Nobody else can take it — but you can pick your own.',
    handleChoose: 'Pick my own username',
    conversations: {
      one: '{count} conversation restored',
      other: '{count} conversations restored',
    },
    conversationsBody:
      'Threads where the other person came back too. The rest arrive if and when they do.',
    tokensCarried: { one: '{count} token', other: '{count} tokens' },
    tokensCarriedBody:
      '{carried} carried over from your old balance, plus {bonus} for coming back.',
    tokensBonus: { one: '{count} token', other: '{count} tokens' },
    tokensBonusBody: 'A welcome-back bonus to start with. Earn more by talking and by correcting.',
    streak: {
      one: '{count}-day streak, still going',
      other: '{count}-day streak, still going',
    },
    streakBody: 'It came back alive, not as a record. Show up tomorrow to keep it.',
    tierForLife: '{plan}, for life',
    proBody:
      'For what you built in v1. It never expires and there is nothing to pay — thank you for being here first.',
  },

  notifications: {
    replyAction: 'Reply',
    replyPlaceholder: 'Write a reply',
    markAsRead: 'Mark as read',
    replyFailed: 'Reply not sent',
    messages: 'Messages',
    messagesBody: 'When somebody writes to you. By email only if you have been away a while.',
    streak: 'Streak reminder',
    streakBody:
      'In the evening, if your streak is about to break. By email if no phone is signed in.',
    badges: 'Badges',
    badgesBody: 'When you earn one. A round-up in the evening, not a buzz each time.',
    profileVisits: 'Profile visits',
    profileVisitsBody:
      'Once a day, how many people looked at your profile. A summary by email each week.',
    meetings: 'Meetings',
    meetingsBody:
      'An hour before a call you both agreed to. The evening mail says what tomorrow holds.',
    social: 'The feed and the people on it',
    socialBody: 'Follows, corrections on your posts, and likes.',
    wallet: 'Tokens',
    walletBody: 'The daily pool paying out, and your hourly gift.',
    promotions: 'News and offers',
    promotionsBody: 'Occasional word about what is new. One tap to stop.',
    echo: 'Echo',
    echoBody: 'Cards due, once in the evening.',
    /** The two halves of every kind above; the row title, so no kind name in it. */
    channel: { push: 'Push', email: 'Daily email' },
    emailUnverified: 'Verify your email address to turn this on.',
    primingTitle: 'Turn on notifications?',
    primingBody:
      'When someone messages you, a nudge at {hour}:00 if your streak is about to break, and once a day how many people viewed your profile.',
    notNow: 'Not now',
    microphonePermission: 'LangX needs microphone access to record a voice message.',
    /**
     * The one place that explains notification permission, exactly as
     * `location.guide` is for location. Four states, because "turn it on" is
     * wrong advice for three of them.
     */
    guide: {
      title: 'Notification permission',
      rowTitle: 'Notification permission',
      rowBody: 'Where to turn notifications on, and what to do if your phone stopped asking.',
      grantedTitle: 'Notifications are on',
      grantedBody:
        'This phone can receive notifications from LangX. Which ones you get is the list on the previous screen, and you can take the permission back in your device settings whenever you like.',
      askableTitle: 'LangX cannot notify you yet',
      askableBody:
        'A message arriving, a nudge if your streak is about to break, and once a day how many people looked at your profile. Nothing is sent while you are reading a chat.',
      allow: 'Allow notifications',
      blockedTitle: 'Your device will not ask again',
      blockedBody:
        'Notifications were declined for LangX, so the app can no longer bring up the permission dialog. You can still turn them on in your device settings.',
      iosStep1: 'Open Settings',
      iosStep2: 'Find LangX in the list',
      iosStep3: 'Tap Notifications and turn on “Allow Notifications”',
      androidStep1: 'Open Settings',
      androidStep2: 'Go to Apps → LangX',
      androidStep3: 'Tap Notifications',
      androidStep4: 'Turn on “All LangX notifications”',
      silencedTitle: 'Silenced on this phone',
      silencedBody:
        'Your device allows notifications, but they are switched off for this phone in LangX. Turn “Notifications on this phone” back on, one screen up — your other devices are unaffected either way.',
      webTitle: 'No push in a browser',
      webBody:
        'Notifications reach you on the LangX app for iPhone or Android. This page has nothing to switch on here.',
      openSettings: 'Open settings',
    },
  },

  corrections: {
    emptyTitle: 'No corrections yet',
    emptyBody:
      'Hold a message in a chat and choose Correct, or fix a sentence someone posted in the feed — it is the most useful thing you can do here.',
    combinedTitle: 'Your writing',
    tabCorrections: 'Corrections',
    tabPosts: 'Posts',
    forName: 'For {name}',
    /**
     * Somebody else's corrections. Only the ones written on posts are here —
     * the profile tile that opens this counts chat corrections and
     * pronunciation recordings too, and neither is a stranger's to read. The
     * note says so, rather than leaving a list that quietly disagrees with the
     * number that led to it.
     */
    publicTitle: 'Corrections',
    publicNote: 'Corrections written on posts. What was corrected in a chat stays in that chat.',
    publicEmptyTitle: 'No post corrections yet',
    publicEmptyBody: '@{handle} has not corrected a post here yet.',
  },
  myPosts: {
    emptyTitle: 'Nothing asked yet',
    emptyBody:
      'Ask about a sentence you are unsure of, or a word you cannot say — it appears here.',
  },
  discover: {
    pickTitle: 'Nobody open',
    pickBody: 'Pick somebody from the list and their profile opens here.',
    boosted: 'Boosted',
    boostedWhat: 'What is this?',
    boostedExplainTitle: 'Boosted profiles',
    boostedExplainBody:
      'People on Fluent and Polyglot are shown here, Polyglot first. The order turns through the day, so everyone takes a turn at the front — a photo, a few words about you, and a recent visit are what put you there. They are matched to your languages exactly as the list below is — nothing about the pairing changes, and anyone can switch it off in Settings.',
    boostedSeePlans: 'See the plans',
    languagesA11y: 'Choose which of your languages to search with',
    searchHandles: 'Search by name or username',
    searchPlaceholder: 'Name or username',
    searchNone: 'No account with that name or username.',
    sortLabel: 'Sort',
    forYou: 'For you',
    title: 'Discover',
    active: 'Active',
    nearby: 'Nearby',
    filters: 'Filters ✦',
    filtersWithCount: 'Filters · {count}',
    locationOffTitle: 'Location sharing is off',
    locationOffBody:
      'Nearby needs to know roughly where you are. Nothing precise is stored, and nobody sees more than a rough distance.',
    turnOn: 'Turn it on',
    turningOn: 'Turning on…',
    /* Only when a radius filter drew the circle. Without one there is no
       circle to widen, which is what `nobodySharing*` says instead. */
    nobodyNearbyTitle: 'Nobody within {radius} km',
    nobodyNearbyBody:
      'Only people who have turned on location sharing appear here. Try a wider radius, or one of the other tabs.',
    nobodySharingTitle: 'Nobody to place yet',
    nobodySharingBody:
      'Nearby can only show people who have turned on location sharing. Try one of the other tabs.',
    nearbyNeedsPermissionTitle: 'Nearby needs your location',
    nearbyNeedsPermissionBody:
      'Location permission has not been granted, so there is nothing to sort by distance.',
    nearbyServicesOffTitle: 'Location is off on this device',
    nearbyServicesOffBody: 'Nearby cannot work until location is switched back on.',
    nearbyUnavailableTitle: 'Could not find you',
    nearbyUnavailableBody: 'No position came back just now. Try again in a moment.',
    emptyTitle: 'Nobody here yet',
    emptyBody:
      'People whose languages match yours in both directions show up here. Try loosening the filters.',
  },

  filters: {
    learns: 'Learns',
    learnsBody: 'Which of the languages you speak they should be learning.',
    title: 'Filters',
    speaks: 'Speaks',
    city: 'City',
    cityNeedsLocation: 'Only people who share their location have a city, so this narrows to them.',
    cityPlaceholder: 'Istanbul',
    gender: 'Gender',
    age: 'Age',
    country: 'Country',
    distance: 'Distance',
    /* Says which sort it reaches, because it reaches exactly one: everywhere
       else this control would be a setting with nothing to set. */
    distanceBody: 'Caps how far Nearby looks. Without it, Nearby just goes from closest outwards.',
    distanceKm: '{km} km',
    practiseBody:
      'Which of your own languages you want to practise. Everyone here already speaks it natively.',
    onlyMyGender: 'Only my gender',
    onlyMyGenderBody: 'Show only people who are {gender}, like you.',
    onlyMyGenderMissing: 'Add your own gender to your profile to use this.',
    theirLevel: 'Their level in your language',
    theirLevelBody:
      'How well they already speak what you teach. Higher means an easier conversation, lower means someone who needs you more.',
    ageRange: '{min} — {max}',
    ageRangeOpen: '{min} — {max}+',
    showResults: 'Show results',
    showResultsWithCount: 'Show results · {count}',
  },

  chats: {
    /** The in-app banner: a face, a name and one line that is never the body. */
    someone: 'Someone',
    bannerA11y: 'New message from {name}',
    preview: { image: '📷 Photo', audio: '🎤 Voice message', correction: '✍️ Correction' },
    delete: 'Delete',
    deleteTitle: 'Delete this chat?',
    deleteBody: 'It stays on their side, and comes back here if they write again.',
    deleted: 'Chat deleted',
    /*
     The car's second line, "3 new", which no other surface draws: CarPlay has
     no badge and Swift has no plural rules, so the phrase is written here and
     carried in the App Group blob the way the widgets' labels are.
    */
    unreadNew: { one: '{count} new', other: '{count} new' },
    tab_all: 'All',
    tab_unreplied: 'Unreplied',
    tab_archived: 'Archived',
    filterPicker: 'Chat filter',
    pin: 'Pin',
    unpin: 'Unpin',
    archive: 'Archive',
    unarchive: 'Unarchive',
    unrepliedEmptyTitle: 'Nothing waiting on you',
    unrepliedEmptyBody: 'Every chat has had your reply.',
    archivedEmptyTitle: 'No archived chats',
    archivedEmptyBody: 'Archived chats stay here until you bring them back.',
    pickTitle: 'No conversation open',
    pickBody: 'Pick one from the list and it opens here.',
    emptyTitle: 'No chats yet',
    emptyBody:
      'Message someone from Discover. On the free plan you can start {count} new chats a day — replying to messages you receive is always unlimited.',
    goToDiscover: 'Go to Discover',
    youPrefix: 'You:',
    starredMessages: 'Starred messages',
  },

  presence: {
    online: 'Online',
    lastSeenNow: 'Last seen just now',
    lastSeenMinutes: {
      one: 'Last seen {count} minute ago',
      other: 'Last seen {count} minutes ago',
    },
    lastSeenHours: { one: 'Last seen {count} hour ago', other: 'Last seen {count} hours ago' },
    lastSeenDays: { one: 'Last seen {count} day ago', other: 'Last seen {count} days ago' },
    lastSeenMonths: { one: 'Last seen {count} month ago', other: 'Last seen {count} months ago' },
    lastSeenYears: { one: 'Last seen {count} year ago', other: 'Last seen {count} years ago' },
    /** After the presence in a chat header: the other person's clock, when it is not the reader's. */
    theirTime: '{time} for them',
    /** The same line read aloud, where the "·" between the halves would be spoken as a symbol. */
    withTheirTimeAccessibility: '{presence}. It’s {time} for them.',
  },
  chat: {
    /** Shown where the composer would be, on an account that takes no messages. */
    channelOnly: 'This account posts news and announcements. You can’t reply to it.',
    /** In place of the composer, when the other person's account is suspended. */
    suspendedOnly: 'This account is suspended. You can’t send it messages.',
    sendingAttachment: 'Sending…',
    title: 'Chat',
    typing: 'typing…',
    notSentRetry: 'Not sent — tap to try again',
    editing: 'Editing',
    correcting: 'Correcting',
    askingCorrection: 'Asking to be corrected',
    askingCorrectionHint: 'Write it your way; they get a Correct button.',
    askingPronunciation: 'Asking how it sounds',
    askingPronunciationHint: 'Write the phrase; they can reply with a voice note.',
    askCorrection: 'Ask me to be corrected',
    askPronunciation: 'Ask how to say it',
    askBadgeCorrection: 'Correction wanted',
    askBadgePronunciation: 'Wants to hear it',
    askAnswerCorrect: 'Correct it',
    askAnswerSay: 'Say it',
    sendTranslatedOn: 'Also send in {language}',
    sendTranslatedOff: 'Stop sending a translation',
    sendTranslatedBanner: 'Sending in {language} too',
    sendTranslatedHint: 'Write in your own language; both go.',
    sendTranslatedFailed: 'Could not translate that, so it went as written.',
    phraseCard: 'Phrase',
    meetingCard: 'Proposed time',
    quizCard: 'Quiz',
    stickers: 'Stickers',
    stickerBuy: 'Unlock for {price} tokens',
    quizAddOption: 'Add an option',
    sendQuiz: 'Ask a quiz',
    quizQuestion: 'Question',
    quizOption: 'Option {number}',
    quizCorrect: 'Which one is right?',
    quizNeedsOptions: 'Fill in at least two options and mark the right one.',
    meetingAccept: 'Accept',
    meetingDecline: 'Decline',
    meetingCancel: 'Withdraw',
    meetingAccepted: 'Accepted',
    meetingDeclined: 'Declined',
    meetingCancelled: 'Withdrawn',
    meetingAddToCalendar: 'Add to calendar',
    meetingSummary: 'LangX with {name}',
    meetingCalendarFailed: 'Could not add this to a calendar from here.',
    meetingCalendarAdded: 'Added to your calendar',
    meetingCalendarPermissionTitle: 'Calendar access',
    meetingCalendarPermission:
      'LangX needs permission to add the session. You can turn it on in Settings.',
    meetingCalendarNone: 'There is no calendar on this device to add it to.',
    meetingYourTime: '{time} your time',
    meetingTheirTime: '{time} theirs',
    unsupportedMessage: 'Update the app to see this message.',
    sendPhrase: 'Save a phrase',
    sendMeeting: 'Propose a time',
    phraseTerm: 'Word or phrase',
    phraseMeaning: 'What it means',
    phraseExample: 'Example (optional)',
    phraseSaved: 'Phrase saved.',
    phraseDeck: 'Saved phrases',
    phraseDeckEmpty: 'Nothing saved here yet.',
    deckExport: 'Export',
    deckExportFailed: 'Could not save that file from here.',
    meetingNote: 'Note (optional)',
    meetingWhenLabel: 'When',
    meetingLength: 'How long',
    meetingPast: 'Pick a time that has not passed.',
    meetingFailed: 'Could not update that meeting.',
    translating: 'Translating…',
    writeMessage: 'Write a message…',
    writeCorrection: 'Write the correction…',
    yourCorrection: 'Your correction',
    correctionFrom: 'Correction from {name}',
    them: 'them',
    tokensPerMessage: {
      one: '+{count} token / message',
      other: '+{count} tokens / message',
    },
    voiceMessage: 'Voice message',
    voiceNeedsEmptyComposer: 'Send the attachment first — a voice note goes on its own.',
    playbackRate: '{rate}×',
    playbackSpeed: 'Playback speed: {rate}×',
    playVoiceMessage: 'Play voice message',
    pauseVoiceMessage: 'Pause voice message',
    voiceMessageUnavailable: 'This voice message will not play on this device.',
    mediaLockedTitle: 'Not yet',
    mediaLocked: {
      one: 'Photos and voice notes unlock after one more message from them.',
      other: 'Photos and voice notes unlock after {count} more messages from them.',
    },
    speaking: 'Reading aloud…',
    playAgain: 'Play again',
    speakUnavailable: 'Couldn’t read that aloud',
    speakFailed: 'Try again in a moment.',
    speakLimit: {
      one: 'You’ve used today’s {count} reading. It resets in 24 hours.',
      other: 'You’ve used today’s {count} readings. They reset in 24 hours.',
    },
    copied: 'Copied',
    couldNotSend: 'Could not send',
    mediaQuota: 'You’ve reached today’s limit for photos, videos and voice messages.',
    attachmentFailed: 'That attachment could not be sent. Try again.',
    photosTitle: 'Photos',
    dropToAttach: 'Drop to attach',
    photosPermission: 'LangX needs permission to open your photo library.',
    microphoneTitle: 'Microphone',
    translationUnavailable: 'Translation unavailable',
    translationQuota: 'You’ve used today’s free translations. A paid plan removes the limit.',
    translationFailed: 'Could not translate that message right now.',
    sayHello: 'Say hello to {name}…',
    pinnedMessage: 'Pinned message',
    goToPinned: 'Go to the pinned message',
    backToLatest: 'Back to latest',
    jumpToNew: {
      one: 'Jump to {count} new message',
      other: 'Jump to {count} new messages',
    },
    jumpToNewest: 'Jump to the newest message',
    replyingToYourself: 'Replying to yourself',
    replyingTo: 'Replying to {name}',
    deleted: 'This message was deleted',
    goToQuoted: 'Go to the quoted message',
    deleteTitle: 'Delete message',
    deleteBothSides: 'This cannot be undone.',
    deleteOwnSide: 'It stays on their device.',
    deleteForEveryone: 'Delete for everyone',
    deleteForMe: 'Delete for me',
    actionFailed: 'That did not go through',
    viewProfile: 'View profile',
    media: 'Photos and voice notes',
    allPhrases: 'All saved phrases',
    phraseScopeMine: 'Mine',
    phraseScopeAll: 'Everything',
    allPhrasesEmpty: 'Save a phrase in any conversation and it will show up here.',
    phraseScopePicker: 'Mine, or every card in my conversations',
    phraseFrom: 'From {name}',
  },

  chatMedia: {
    title: 'Media',
    tabVisual: 'Photos & video',
    tabAudio: 'Voice notes',
    emptyVisual: 'Photos and video you send each other will collect here.',
    emptyAudio: 'Voice notes from this chat will collect here.',
    tabPicker: 'Photos and video, or voice notes',
  },

  messageMenu: {
    more: 'More…',
    backToFirstPage: 'Back to the first page',
    reactWith: 'React with {emoji}',
  },

  day: {
    today: 'Today',
    yesterday: 'Yesterday',
  },

  starred: {
    title: 'Starred',
    emptyTitle: 'Nothing starred yet',
    emptyBody: 'Hold a message and choose Star to keep it here.',
  },

  activity: {
    fillInDay: 'Fill in {day}',
    fillInTitle: 'Fill in {day}?',
    fillIt: 'Fill it in',
    filled: 'Day filled in',
    fillFailed: 'Could not fill that day',
    noRepairsTitle: 'No repairs left',
    notEnoughTokensTitle: 'Not enough tokens',
    notEnoughTokensBody: 'Filling a day costs {price}. You have {balance}.',
    /**
     * The *second* number decides the plural — "from 1 to 2 days", "from 6 to
     * 1 day" — so `count` is `after` and `before` is only interpolated.
     */
    streakChange: {
      one: 'Your streak goes from {before} to {count} day.',
      other: 'Your streak goes from {before} to {count} days.',
    },
    noStreakChange: 'It fills the square, but does not change your streak.',
    balanceChange: '{streakLine}\nYour balance goes {before} → {after}.',
    perMonth: {
      one: 'You can fill in {count} day a month.',
      other: 'You can fill in {count} days a month.',
    },
    weeksAgo: { one: '{count} week ago', other: '{count} weeks ago' },
  },

  report: {
    messageQuestion: 'Why are you reporting this message?',
    profileQuestion: 'Why are you reporting this profile?',
    postQuestion: 'Why are you reporting this post?',
    spam: 'Spam',
    harassment: 'Harassment',
    hateSpeech: 'Hate speech',
    hateSpeechHint:
      'Attacks based on who someone is, including sexual orientation and gender identity',
    inappropriateContent: 'Inappropriate content',
    fakeProfile: 'Fake profile',
    underage: 'Under 16',
    other: 'Something else',
    details: 'What happened?',
    detailsPlaceholder: 'Optional. Anything that helps us understand.',
    submit: 'Send report',
    messageSent: 'Reported. Thank you — we look at every one.',
    profileSent: 'Report sent. We will look into it.',
    failed: 'Could not report',
  },

  /**
   * The notification centre. Its own namespace rather than a corner of
   * `notifications` above: that one is the settings switches, and three of its
   * keys are words this one also needs.
   */
  inbox: {
    title: 'Notifications',
    bell: 'Notifications',
    unread: 'Unread',
    markAllRead: 'Mark all read',
    emptyTitle: 'Nothing yet',
    emptyBody: 'Follows, corrections and likes on what you post land here.',
    follow: '{name} followed you',
    postComment: '{name} commented on your post',
    postCorrection: '{name} corrected your sentence',
    pronunciationAnswer: '{name} recorded your sentence',
    like: '{name} liked your post',
    /** `{count}` is how many *others*, so it is never zero. */
    likeOthers: {
      one: '{name} and {count} other liked your post',
      other: '{name} and {count} others liked your post',
    },
    postCommentOthers: {
      one: '{name} and {count} other commented on your post',
      other: '{name} and {count} others commented on your post',
    },
    postCorrectionOthers: {
      one: '{name} and {count} other corrected your sentence',
      other: '{name} and {count} others corrected your sentence',
    },
    pronunciationAnswerOthers: {
      one: '{name} and {count} other recorded your sentence',
      other: '{name} and {count} others recorded your sentence',
    },
    badgeEarned: 'You earned a new badge',
    walletPool: {
      one: "Yesterday's pool paid you {count} token",
      other: "Yesterday's pool paid you {count} tokens",
    },
    profileVisits: {
      one: '{count} person looked at your profile',
      other: '{count} people looked at your profile',
    },
    /**
     * What a folded row says about the days behind it.
     *
     * Deliberately naming nothing — days for a visit round-up or a pool
     * payout, badges for a badge. One line for three kinds beats three that
     * differ only in a noun nobody reads.
     */
    earlier: {
      one: '+{count} more',
      other: '+{count} more',
    },
  },
  feed: {
    pickTitle: 'No post open',
    pickBody: 'Pick one from the feed and it opens here.',
    topTag: 'Top',
    ask: '+ Ask',
    askTitle: 'Your sentence in {language}',
    postLanguage: 'Language to post in',
    askPlaceholder: 'The sentence you are unsure about…',
    posting: 'Posting…',
    posted: 'Posted. Somebody will correct it.',
    correctionSent: 'Correction sent. Thank you.',
    correctedEmptyTitle: 'Everything is corrected',
    correctedEmptyBody:
      'Nobody is waiting for help right now. Post a sentence of your own, or come back later.',
    noCorrections: 'No corrections yet',
    corrections: { one: '{count} correction', other: '{count} corrections' },
    topCorrection: 'Top correction ·',
    yourCorrection: 'Your correction',
    sending: 'Sending…',
    sendCorrection: 'Send correction',
    youCorrected: 'You corrected this',
    correctThis: 'Correct this',
    likes: { one: '{count} like', other: '{count} likes' },
    like: 'Like',
    unlike: 'Unlike',
    likedBy: 'Liked by',
    likersEmptyTitle: 'No likes yet',
    likersEmptyBody: 'Be the first to say this helped.',
    recordVoice: 'Record a voice note',
    photoAttached: 'Photo attached',
    videoAttached: 'Video attached',
    voiceAttached: 'Voice note attached',
    photosPermission: 'LangX needs access to your photos and videos to attach one.',
    attachmentFailed: 'The attachment did not upload. Try again.',
    mediaQuota: 'You have reached today’s attachment limit.',
    correctionsEmptyTitle: 'No corrections yet',
    correctionsEmptyBody: 'Be the first to correct this sentence.',
    title: 'Feed',
    post: 'Post',
    correctionSection: 'Corrections',
    pronunciationSection: 'Pronunciation',
    comment: 'Comment',
    comments: { one: '{count} comment', other: '{count} comments' },
    addComment: 'Add a comment',
    commentPlaceholder: 'Say something…',
    allComments: 'Comments',
    showMoreComments: 'Show more comments',
    commentsEmptyBody: 'Be the first to say something.',
    pronounceAsk: '+ How is it said?',
    pronounceTitle: 'The word in {language}',
    pronouncePlaceholder: 'The word or sentence you cannot say…',
    pronounceEmptyTitle: 'Nothing to say out loud',
    pronounceEmptyBody: 'Nobody is waiting to hear a word said. Ask about one of your own.',
    answers: {
      one: '{count} recording',
      other: '{count} recordings',
    },
    noAnswers: 'No recordings yet',
    answerThis: 'Record',
    normalTake: 'Normal speed',
    slowTake: 'Said slowly',
    addSlowTake: 'Add a slow take',
    stopRecording: 'Stop',
    recordAgain: 'Record again',
    sendAnswer: 'Send recording',
    answerSent: 'Recording sent. Thank you.',
    youAnswered: 'You recorded this',
    answersEmptyTitle: 'No recordings yet',
    answersEmptyBody: 'Be the first to say it out loud.',
    needRecording: 'Record it once before sending.',
    alreadyCorrected: 'You have already corrected this one.',
    wrongPostKind: 'That post is asking for something else.',
    deletePost: 'Delete post',
    deleteComment: 'Delete comment',
    deleteCorrection: 'Delete correction',
    deleteAnswer: 'Delete recording',
    deleteConfirmTitle: 'Delete this?',
    deletePostConfirmBody:
      'Its corrections, recordings and comments go too. Tokens people earned stay theirs.',
    deleted: 'Deleted.',
    correctionPlaceholder: 'Rewrite the sentence the way you would say it…',
    startFromOriginal: 'Start from the original',
    correctionReward: {
      one: '+{count} token · Unlimited on every plan',
      other: '+{count} tokens · Unlimited on every plan',
    },
    composeHint:
      'Somebody native will fix it — usually within the hour. Corrections are unlimited on every plan.',
    voiceNote: 'Voice note',
    top: 'Top',
  },

  profile: {
    /** Screen-reader label for the tick beside @langx and @copilot. */
    official: 'Official account',
    suspendedTag: 'Suspended',
    deletedTag: 'Account deleted',
    previewTitle: 'Preview',
    previewNote:
      'This is your profile as other people see it — your privacy settings are already applied.',
    teaches: 'Teaches',
    learns: 'Learns',
    openChat: 'Open your chat',
    follow: 'Follow',
    following: 'Following',
    followers: { one: '{count} follower', other: '{count} followers' },
    followingCount: { one: '{count} following', other: '{count} following' },
    followersTitle: 'Followers',
    /**
     * The third stat tile, where the badge count used to be. A percentile
     * rather than "#41,205": a rank is only worth reading at the very top of a
     * board, and a percentile stays legible as the app grows.
     *
     * The number alone, with `rankLabel` under it — the tile is the same shape
     * as the two beside it, and "Top" was a word doing the work the small
     * print already does. It stays a key rather than becoming `${n}%` in the
     * component because Turkish writes the sign first: %12, not 12%.
     */
    rankLabel: 'This week',
    rankValue: '{percent}%',
    badgeStrip: { one: '{count} badge earned', other: '{count} badges earned' },
    followingTitle: 'Following',
    followersEmptyTitle: 'No followers yet',
    followersEmptyBody: 'Corrections are how people find each other here.',
    followingEmptyTitle: 'Not following anyone yet',
    followingEmptyBody: 'Follow someone and their posts appear in your feed.',
    followFailed: 'That did not work. Try again.',
    notFound: 'Profile not found.',
    interests: 'Interests',
    sendMessage: 'Send a message',
    sendFailed: 'Could not send the message.',
    blockConfirm: 'Block {name}? Neither of you will appear in the other’s lists.',
    blocked: '{name} is blocked.',
    people: 'People',
    dayStreak: { one: '{count} day streak', other: '{count} day streak' },
  },

  me: {
    languages: 'Languages',
    viewersTitle: 'Who viewed your profile',
    viewersLocked: {
      one: '{count} person looked — see who with {plan}',
      other: '{count} people looked — see who with {plan}',
    },
    viewersCount: { one: '{count} person', other: '{count} people' },
    proTitle: '✦ Go further',
    proBody: 'Unlimited new chats, advanced filters, translation, and two languages at once.',
    polyglotTitle: '✦ Upgrade to {plan}',
    polyglotBody:
      'See who viewed you, browse incognito, sort by distance, and send messages in their language.',
    newChatsLeft: 'New chats left today:',
    editProfile: 'Edit profile',
    settings: 'Settings',
    scan: 'Scan a code',
    corrections: 'Corrections',
    wallet: 'Wallet',
    previewProfile: 'Preview my profile',
    previewProfileBody: 'See your profile the way other people do',
    shareProfile: 'Share my profile',
    shareMessage: 'Practise languages with me on LangX: {url}',
    badges: 'Badges',
    echoWeek: 'Echo this week',
    invite: 'Invite a friend',
    inviteBody: 'Earn tokens when they start using LangX',
    dayStreak: 'Day streak',
    followsTitle: 'Followers and following',
    nextBadge: 'Next: {label}',
    hiddenFromOthers: 'Hidden from others',
  },

  /**
   * "How LangX works", behind the link at the foot of the Me tab. Each topic
   * describes what the app does today, and the rules are
   * `docs/community-guidelines.md`'s list — change one, change the other.
   */
  howItWorks: {
    title: 'How LangX works',
    featuresSection: 'Learning features',
    gotIt: 'Got it',
    whatTitle: 'What is LangX',
    whatBody:
      'A place to practise a language with the people who speak it. Everyone you are matched with is native in a language you are learning and is learning one you speak — you teach yours, they teach theirs, and both of you get better.',
    whatBody2:
      'Nobody here is a paid teacher. Everybody is learning something, and everybody is the expert in their own language.',
    helpTitle: 'How to help your partner learn',
    helpBody: 'A good partner is not a perfect one — just someone who makes it easy to keep going.',
    helpTakeTurns: 'Take turns: some of the time in their language, some in yours.',
    helpCorrect: 'Correct one or two things at a time, not every mistake in a message.',
    helpSimple: 'Write simply, and slow down when they ask you to.',
    helpQuestions: 'Ask questions. A reply is easier to write than a first message.',
    helpPatient: 'Be patient. You are learning too.',
    rulesTitle: 'Unacceptable behaviour',
    rulesLead:
      'LangX is for practising a language. Any of these can get an account suspended or removed for good.',
    rulesHarassment: 'Harassment, or keeping on after someone has stopped replying',
    rulesHate: 'Hate speech and slurs',
    rulesSexual: 'Sexual content and unwanted advances — LangX is not a dating app',
    rulesMinors: 'Anything that sexualises a minor',
    rulesImpersonation: 'Pretending to be someone else, or lying about your age',
    rulesPrivate: 'Posting someone else’s private information',
    rulesSpam: 'Spam, scams, advertising, and asking for money',
    rulesTopics:
      'Politics and religion are not off limits — a language is not much use if you can only talk about the weather. Hostility towards a person is.',
    rulesBlock:
      'Blocking works at once, and the other person is not told. Reporting sends it to us.',
    rulesAccept: 'I understand',
    rulesRead: 'Read the full guidelines',
    holdTitle: 'Hold a message',
    holdBody:
      'Press and hold any message to see what you can do with it. Reply, correct, translate, copy, or keep it in Echo — what is offered depends on the message and who sent it.',
    correctTitle: 'Correct and be corrected',
    correctBody:
      'Hold your partner’s message and choose Correct. Fix what is wrong and send it: they see exactly what changed. Corrections are unlimited on every plan.',
    translateTitle: 'Translate a message',
    translateBody:
      'Hold a message and choose Translate. The translation appears under it, in your own language, without leaving the chat. If you speak more than one, pick which in Settings.',
    voiceTitle: 'Voice notes',
    voiceBody:
      'Tap the microphone to record. Play it back before you send it — hearing a word is half of learning it.',
    echoTitle: 'Keep it in Echo',
    echoBody:
      'Hold a message and choose Add to Echo. The sentence comes back in the Echo tab just before you would forget it, until you know it.',
    feedTitle: 'Ask the Feed',
    feedBody:
      'Post a sentence to have it corrected, or ask how a word is said and someone will record it. Then do the same for somebody else.',
    streakTitle: 'Streaks and tokens',
    streakBody:
      'One message a day keeps your streak alive. Talking and teaching earn tokens, which you can spend on a streak freeze or a new look for your profile.',
    discoverTitle: 'Find a partner',
    discoverBody:
      'Everyone in Discover speaks a language you are learning and is learning one you speak. For you is matched to your languages, Active is who has just been around, and Nearby uses your location once you share it. Open a profile and say hello — that is how almost every exchange here begins.',
    plusTitle: 'The + button',
    plusBody:
      'Tap + beside the message box. As well as photos and voice notes, you can ask to be corrected, ask how something is said and get a voice note back, save a phrase with what it means, propose a time to talk, or send a quiz with one right answer.',
    sendTranslationTitle: 'Write in their language',
    sendTranslationBody:
      'Tap + and choose to also send in your partner’s language. Write in yours and both go, so they read you without guessing. This one comes with {plan}.',
  },

  editProfile: {
    countryUnknown: 'Not set',
    countryHint: 'From your connection',
    title: 'Edit profile',
    displayName: 'Display name',
    aboutYou: 'About you',
    languageWithLevel: '{language} · {level}',
    aboutYouPlaceholder: 'What do you like talking about?',
    country: 'Country',
    gender: 'Gender',
    genderOnce: 'You can change this once every {days} days.',
    genderCooldown: 'You can change this again on {date}.',
    usernameEvery: 'You can change this once every {days} days.',
    usernameCooldown: 'You can change this again on {date}.',
    pronouns: 'Pronouns',
    pronounsPlaceholder: 'she/her, they/them, o…',
    pronounsHint: 'Optional, and shown on your profile. Write them however your language does.',
    genderConfirmTitle: 'Set your gender?',
    genderConfirmBody: 'Your profile will say {gender}. You can change it again in {days} days.',
    languages: 'Languages',
    longPressToRemove: 'Long-press a photo to remove it.',
    removePhotoTitle: 'Remove photo',
    removePhotoBody: 'Remove this photo from your profile?',
    photoPreparing: 'Preparing photo…',
    photoUploading: 'Uploading photo, {percent}%',
    photoRetry: 'That photo didn’t upload. Tap to try again, or press and hold to remove it.',
    photoRetryShort: 'Retry',
    photoLimit: 'You can add up to {max} photos.',
    photosTrimmed: 'Your gallery holds {max} photos, so not all of those were added.',
    photoUpdated: 'Photo updated.',
    saved: 'Profile saved.',
    saveFailed: 'Could not save your profile.',
    storageUnconfigured: 'Photo storage is not configured on this server yet.',
    uploadRetry: 'Could not upload that image. Try again.',
    interestsUpTo: 'Interests · up to {max}',
  },

  /**
   * The languages screen. Its own block rather than more of `editProfile`,
   * because it is its own screen — and because every sentence here exists to
   * answer a control that would otherwise dim without a word.
   */
  languages: {
    title: 'Your languages',
    nativeSection: 'Native',
    nativeBody: 'The languages you grew up with. People learning them find you this way.',
    learningSection: 'Learning',
    learningBody: 'What you are learning. The first one leads your profile.',
    addNative: 'Add a native language',
    addLearning: 'Add a language you are learning',
    pickNativeTitle: 'Native language',
    pickLearningTitle: 'Language you are learning',
    replaceTitle: 'Change {language}',
    replaceBody: 'Pick the language that takes its place.',
    startsAtNew: 'It starts at the first level. You can change that afterwards.',
    alreadyInList: 'You already have {language}.',
    overlapRefused: 'A language cannot be both native and one you are learning.',
    moveUp: 'Move {language} up',
    moveDown: 'Move {language} down',
    reorder: 'Reorder {language}',
    removeTitle: 'Remove {language}?',
    removeBody: 'It comes off your profile straight away.',
    lastNative: 'You need at least one native language. Change this one rather than removing it.',
    lastLearning:
      'You need at least one language you are learning. Change this one rather than removing it.',
    capReached: {
      one: 'Your plan holds {count} language in this list.',
      other: 'Your plan holds {count} languages in this list.',
    },
    capReachedShort: {
      one: 'Your plan holds {count} language.',
      other: 'Your plan holds {count} languages.',
    },
    capUpgrade: '{fluent} holds {fluentMax}, {polyglot} holds {polyglotMax}.',
    capOverGrandfathered:
      'You already have more than your plan holds. You can change these or remove them, but not add another.',
    changeHint: 'Tap a language to change it.',
    saveFailed: 'That did not save. Nothing changed.',
  },

  legal: {
    community: 'Community guidelines',
    privacy: 'Privacy policy',
    terms: 'Terms & conditions',
    cookies: 'Cookie policy',
    dataDeletion: 'Delete my data',
    security: 'Security',
  },
  feedback: {
    bugTitle: 'Report a bug',
    featureTitle: 'Request a feature',
    bugRowBody: 'Something broken? Tell us, and earn tokens for it.',
    featureRowBody: 'Something missing? Tell us what you would use.',
    bugIntro:
      'Tell us what happened, what you expected instead, and how to make it happen again. The more exactly you describe it, the sooner it is fixed.',
    featureIntro:
      'Tell us what you would like to be able to do, and what you would use it for. Why it matters to you is the part that decides what gets built.',
    reward:
      'If we confirm it, you earn tokens for it — how many depends on how much it turns out to be worth.',
    bugPlaceholder: 'What happened, and what you expected…',
    featurePlaceholder: 'What you would like, and what you would use it for…',
    hint: 'A screenshot or a screen recording helps more than anything else. We answer by email, and what you write may be opened as a public issue on GitHub — without your name on it.',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Thank you. We read every one of these and answer by email.',
    failed: 'That did not send. Try again in a moment.',
    tooMany: 'You have sent a few of these already. Try again in an hour.',
    tooShort: {
      one: 'A little more — at least one character.',
      other: 'A little more — at least {count} characters.',
    },
  },
  kitchen: {
    title: 'Our Kitchen',
    intro: 'Where LangX is made, and everyone who makes it.',
    dataCredit: 'Place names from GeoNames, licensed under CC BY 4.0.',
    stickerCredit: 'Some stickers from Microsoft Fluent Emoji, licensed under MIT.',
    footer: 'Built in the open, by the people who use it.',
    contributors: 'Contributors',
    fundamentals: 'Everyone who has contributed',
    backers: 'Our backers',
    support: 'Support us',
    joinDiscord: 'Join us on Discord',
    patron: 'Be a patron',
    sponsor: 'Sponsor us on GitHub',
    followX: 'Follow us on X',
    token: 'LangX Token',
    tokenWebsite: 'Token website',
    litepaper: 'Litepaper',
    about: 'About us',
    website: 'Website',
    insights: 'Insights',
    backlog: 'Backlog',
    releases: 'Release notes',
    issues: 'Issues',
    contributing: 'Contributing',
    status: 'Status page',
    social: 'Social',
    blog: 'Blog',
    licenses: 'Licenses',
    codeOfConduct: 'Code of conduct',
    moreContributors: '+{count}',
  },
  streak: {
    title: 'Your streak',
    historyBody: 'Every day of the last two months, and what counted',
    leaderboardBody: 'Who has the longest run right now, and ever',
    protectTitle: 'Protect your streak',
    protectBody:
      'A freeze covers the next day you miss. A day already missed can be bought back on the map above, for a month.',
    longest: 'Longest',
    missed: 'Missed',
    bought: 'Filled in with tokens',
    openedOnly: 'Opened the app',
    checkedInUnknownTime: 'Checked in',
    checkedInAt: {
      one: 'Checked in at {time} · {count} action',
      other: 'Checked in at {time} · {count} actions',
    },
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Send a message or write a correction, and today becomes your first day.',
    legendMissed: 'Missed · tap to fill in',
  },
  settings: {
    scanBody: 'Sign in on a computer, or open a friend’s profile',
    subscriptionBody: 'Your plan, renewal and how to manage it',
    shareSection: 'Share & invite',
    shareBody: 'Your profile link, QR code and referral invite',
    privacyBody: 'Who can find you, and what they see',
    notificationsBody: 'What reaches you, by push and by email',
    appearanceSection: 'Appearance',
    appearanceBody: 'Theme, app icon, language and tips',
    accountBody: 'How you sign in, devices, blocked people, your data',
    signInMethods: 'Sign-in methods',
    signInMethodsBody: 'How you get into your account',
    signInIdentifiers: 'You can sign in with either of these:',
    signInPasswordTitle: 'Password',
    signInPasswordSet: 'Set',
    signInPasswordNotSet: 'Not set',
    signInSetPassword: 'Set a password',
    signInSetPasswordBody: 'So you can get in without Google or Apple.',
    signInSetPasswordSaved: 'Password set.',
    signInSetPasswordFailed: 'Could not set your password. Try again.',
    signInPasswordAlready: 'This account already has a password.',
    username: 'Username',
    usernameBody: 'Change it once every {days} days',
    usernameTitle: 'Change your username',
    usernameIntro: 'You are @{handle}. Pick the username you want instead.',
    usernameIntroV1:
      'When you joined the old LangX it named you @{handle}. You never picked that, so you can pick one now.',
    usernameHint: 'Letters, numbers and underscores. This is how people find you.',
    usernameEvery:
      'You can change this once every {days} days. Links and QR codes with your old username keep working until you change it again.',
    usernameSave: 'Change username',
    usernameSaved: 'You are @{handle} now.',
    usernameFailed: 'Could not change your username. Try again.',
    usernameReserved: '@{handle} belongs to another account from the old LangX.',
    usernameCooldown: 'You are @{handle}. You can change it again on {date}.',
    usernameConfirmTitle: 'Change your username?',
    usernameConfirmBody:
      'You will be @{handle}. You can change it again in {days} days, not before.',
    password: 'Password',
    passwordBody: 'Set or change it',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    changePasswordSaved: 'Password changed.',
    changePasswordFailed: 'Could not change your password. Try again.',
    currentPasswordWrong: 'That is not your current password.',
    signInConnected: 'Connected accounts',
    signInConnectedSince: 'Connected {date}',
    signInNoneConnected: 'Nothing connected',
    signInOnlyProvider:
      'This is your only way in. Set a password so you are not locked out if you lose access to it.',
    aboutSection: 'About',
    aboutBody: 'Legal, community and the intro',
    search: 'Search settings',
    searchNone: 'No setting matches that.',
    appIconSection: 'App icon',
    appIcon: 'Home screen icon',
    appIconBody: 'Pick which one sits on your home screen.',
    appIcon_default: 'Classic',
    appIcon_dark: 'Dark',
    appIcon_split: 'Split',
    appIcon_pro: 'Pro',
    appIcon_newYear: '2026',
    appIconChanged: 'Icon changed.',
    appIconFailed: 'Could not change the icon',
    showWeekChart: 'Show this week’s chart',
    showWeekChartBody: 'Which days you sent messages and corrections, on your profile.',
    voiceCredits: 'Voices and licences',
    voiceCreditsBody:
      'Messages are read aloud by open-source voice models. Most ask nothing of us; the ones below are licensed on the condition that we credit the people who recorded them.',
    voiceCreditsEngines: 'The engines are Kokoro-82M and Piper, both open source.',
    legalSection: 'Legal',
    linkDeviceBody: 'Approve a sign-in, and see where you are signed in.',
    showInDiscover: 'Show me in Discover',
    showInDiscoverBody:
      'Turn this off and nobody will find you — not in Discover, and not by searching your username.',
    boost: 'Boost my profile',
    boostBody:
      'Show me in the Boosted strip at the top of Discover, to people whose languages match mine. On with Fluent and Polyglot.',
    incognito: 'Browse incognito',
    incognitoBody: 'You won’t appear in their viewers.',
    hideOnline: 'Hide when I’m online',
    hideOnlineBody: 'Hides your green dot and when you were last here. You can still see theirs.',
    hideCity: 'Hide my city',
    hideCityBody:
      'Your city and time zone are worked out from your location. This keeps both off your profile; distance and country are unaffected.',
    shareLocation: 'Share rough location',
    shareLocationBody: 'Others see a distance bucket, never a point.',
    shareUsage: 'Share usage data',
    shareUsageBody:
      'Which screens and buttons get used, and a recording of the screen with every word and picture blanked out — never what you write. It shows us where people get stuck.',
    activityMap: 'Show my activity map',
    activityMapBody: 'The squares on your profile. Your streak stays visible either way.',
    updateLocation: 'Update my location',
    locationUpdated: 'Last updated {time} ago',
    updating: 'Updating…',
    privacyFailed: 'Couldn’t save that setting',
    appLanguage: 'App language',
    translateTo: 'Translate into',
    translateToBody: 'Which of your languages a translated message is shown in',
    translateToScreenBody:
      'Messages you translate are shown in this language. Only your native languages are offered.',
    translateToFirst: 'Your first language — the default',
    languageAuto: 'Device ({name})',
    blockedPeople: 'Blocked people',
    showIntro: 'Show intro again',
    showTour: 'Replay the tour',
    showTourBody: 'Walk through the Discovery screen again, one step at a time.',
    rateApp: 'Rate LangX',
    exportData: 'Export my data',
    deleteAccount: 'Delete account',
    deleteAccountBody: 'Signing back in within {days} days cancels it.',
    deleteConfirmTitle: 'Delete your account',
    deleteExplain:
      'Your profile, messages and photos are scheduled for deletion. Sign back in within {days} days and everything comes back; after that it is gone for good.',
    deleteTypeHandle: 'Type your handle, {handle}, to continue.',
    deleteCheckEmail: 'Check {email}. The link in that message is what schedules the deletion.',
    deleteNothingYet: 'Nothing has happened to your account yet.',
    deleted: 'Account deleted. Signing back in within {days} days cancels it.',
    deleteFailed: 'Could not delete',
    signOut: 'Sign out',
    signOutConfirm: 'You will need to sign in again on this device.',
    licence: '· BSD-3 · open source',
    title: 'Settings',
    privacySection: 'Privacy',
    subscriptionSection: 'Subscription',
    currentPlan: 'Current plan',
    renewsOn: 'Renews on',
    endsOn: 'Ends on',
    lifetime: 'Lifetime',
    plan: 'Plan',
    manageSubscription: 'Manage or cancel',
    upgrade: 'See the plans',
    upgradeTo: 'Upgrade to {plan}',
    notificationsSection: 'Notifications',
    pushThisDevice: 'Notifications on this device',
    pushThisDeviceBody: 'Turn these off here and your other devices keep receiving them.',
    accountSection: 'Account',
    translationsLeft: {
      one: '{count} free translation left today',
      other: '{count} free translations left today',
    },
    whatYouHave: 'What you have',
    signInConnect: 'Connect',
    signInDisconnect: 'Disconnect',
    signInDisconnectConfirm:
      'Disconnect {provider}? You will no longer be able to sign in with it.',
    signInLastMethod: 'Your only way in — set a password before disconnecting it.',
    signInLinked: 'Connected.',
    signInUnlinked: 'Disconnected.',
    signInLinkFailed: 'Could not connect. Try again.',
    signInUnlinkFailed: 'Could not disconnect. Try again.',
    exportPhrases: 'Export every phrase',
    exportPhrasesBody: 'Every card you have saved, from every conversation, as one file.',
  },

  deletion: {
    today: 'Your account is being deleted today.',
    tomorrow: 'Your account will be deleted tomorrow.',
    inDays: {
      one: 'Your account will be deleted in {count} day.',
      other: 'Your account will be deleted in {count} days.',
    },
    untilThen: 'Until then nobody can find you or see your profile.',
    keepIt: 'Keep it',
    keeping: 'Wait…',
  },

  store: {
    streakFreeze: 'Streak freeze',
    streakFreezeBody: 'Covers the next day you miss · {banked}/{max} banked',
    ownedAccessibility: '{title}, owned',
    locked: 'Locked',
    lockedAccessibility: '{title}, locked',
    lockedStreak: '{current} of {threshold} days',
    lockedNeeds: 'Buy {title} first',
    lockedCorrections: '{current} of {threshold} corrections',
    frameKind: 'Profile frame',
    stickerKind: 'Sticker pack',
    titleKind: 'Title',
    repairDay: 'Buy a day back',
    repairDayBody: 'Fills in a day you missed · {left} left this month',
    bought: '{title} is yours',
    notEnoughTitle: 'Not enough tokens',
    notEnoughBody: '{title} costs {price}. You have {balance}.',
    buyFailed: 'Could not buy that',
    equipFailed: 'Could not change that',
    frames: 'Profile frames',
    stickers: 'Sticker packs',
    titles: 'Titles',
    wear: 'Wear',
    owned: 'Owned',
    wearing: 'Wearing',
    price: { one: '{count} token', other: '{count} tokens' },
    buyAccessibility: 'Buy {title} for {price}',
  },

  gift: {
    title: 'Hourly gift',
    body: 'A small gift every hour, for free. Most hold a handful of tokens; a few hold more.',
    ready: 'Ready to open',
    nextIn: 'Next one in {minutes} min',
    shakeHint: 'Shake your phone to open it',
    tapHint: 'Tap to open it',
    opening: 'Opening…',
    revealedZero: 'Empty this time. Another one in an hour.',
    failed: 'Could not open the gift',
    done: 'Done',
    openAccessibility: 'Open the hourly gift',
    tokensUnit: { one: 'token', other: 'tokens' },
    anotherInAnHour: 'Another one in an hour.',
  },

  wallet: {
    title: 'Wallet',
    balance: 'Balance',
    earnedSpent: '{earned} earned · {spent} spent',
    streakFreezes: 'Streak freezes',
    itemsOwned: 'Items owned',
    storeTitle: 'Store',
    historyBody: 'What you earned and spent, day by day',
    leaderboardBody: 'Who earned the most this week, month and year',
    poolBody: 'How the nightly share is worked out',
    storeBody: 'Streak freezes, missed days and cosmetics',
    disclaimer:
      'Tokens are in-app points. They cannot be bought, traded, withdrawn or used to unlock a paid plan — only streak freezes, missed days and cosmetics. There is no chain, no contract and no market.',
  },

  tokens: {
    intro:
      'Earned by messaging and by correcting other people. Teaching is weighted higher than talking.',
    poolTitle: 'Daily pool',
    shareAmount: '+{count}',
    noShareYet: 'No share yet — the pool pays out after your first full day.',
    firstShareAt: 'Your first share lands {when}.',
    poolCap: "Cap {cap} a day. Your share moves with everyone else's.",
    poolPaidAt: 'Paid every night at {hour}:00 UTC.',
    history: 'History',
    historyEmpty: 'Nothing yet. Send a message, or correct someone.',
    historyMore: 'Show more',
    ledgerSpent: '−{count}',
    shareForDay: 'Your share for {day}',
    todaySoFar: 'Today so far',
    activityScore: { one: '{count} activity', other: '{count} activity' },
    todayBreakdown: '{messages} messages, {corrections} corrections, {partners} people.',
    poolParticipants: { one: '{n} active that day', other: '{n} active that day' },
    poolShareOfPool: '{percent} of the daily pool',
    poolActiveToday: { one: '{n} active today', other: '{n} active today' },
  },

  /** One per `TOKEN_KINDS`; `kindKey()` builds the key from the kind itself. */
  invite: {
    title: 'Invite a friend',
    body: 'Share your link. When someone you invited signs up and starts talking to people, you both earn tokens.',
    code: 'Your invite code',
    share: 'Share the link',
    copy: 'Copy the link',
    copied: 'Link copied',
    shareMessage: 'Practise languages with me on LangX: {url}',
    howTitle: 'How it works',
    step1: 'Send your link to somebody learning your language.',
    step2:
      'They sign up and write their first message or correction — that is when you earn {activation} tokens.',
    step3:
      'If they ever start a paid plan, you earn {subscription} more. {max} in total, per person.',
    step4:
      'They earn too: {invitee} more at that same moment, so with the sign-up bonus they start with {total}.',
    totalsInvited: {
      one: 'invited',
      other: 'invited',
    },
    totalsActivated: {
      one: 'active',
      other: 'active',
    },
    totalsEarned: {
      one: 'token',
      other: 'tokens',
    },
    statusPending: 'Has not written yet',
    statusActivated: 'Active',
    statusSubscribed: 'Subscribed',
    emptyTitle: 'Nobody yet',
    emptyBody: 'Share your link and whoever joins will show up here.',
    disclaimer:
      'Tokens are in-app points. Nothing is paid for signing up — an invite earns only once the person you invited actually writes to somebody.',
  },

  tokenKind: {
    message: 'Messages',
    correction: 'Corrections',
    streak: 'Streak bonus',
    dailyPool: 'Pool share',
    adjustment: 'Adjustment',
    legacyTokenConversion: 'v1 balance',
    welcomeBack: 'Welcome back bonus',
    signupBonus: 'Signup bonus',
    spend: 'Spent',
    pronunciation: 'Pronunciation',
    referral: 'Invite bonus',
    referralSubscription: 'Invite subscription bonus',
    referralWelcome: 'Invite welcome bonus',
    gift: 'Hourly gift',
    bounty: 'Bug bounty',
    reportReward: 'Report reward',
    echo: 'Echo session',
  },

  cosmetics: {
    stickersPixel: 'Pixel stickers',
    stickersPractice: 'Practice stickers',
    stickersStarter: 'Starter stickers',
    frameSlate: 'Slate frame',
    frameBronze: 'Bronze frame',
    frameSky: 'Sky frame',
    frameSilver: 'Silver frame',
    frameMint: 'Mint frame',
    frameEmber: 'Ember frame',
    frameGold: 'Gold frame',
    frameViolet: 'Violet frame',
    frameMidnight: 'Midnight frame',
    frameAurora: 'Aurora frame',
    titleBeginner: 'Beginner',
    titleLearner: 'Learner',
    titleHelper: 'Helper',
    titleTutor: 'Tutor',
    titleMentor: 'Mentor',
    titleLinguist: 'Linguist',
    titlePolyglot: 'Polyglot',
    titleScholar: 'Scholar',
    titleMaster: 'Master',
    titleLegend: 'Legend',
  },

  leaderboard: {
    title: 'Leaderboard',
    periodPicker: 'Leaderboard period',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Send messages and write corrections — be the first to earn tokens this period.',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    badges: 'Badges',
    pays: { one: 'Pays {amount} token', other: 'Pays {amount} tokens' },
    you: 'You',
    streakTitle: 'Leaderboard',
    metricCurrent: 'Now',
    metricLongest: 'Longest',
    streakPicker: 'Streak ranking',
    streakEmptyTitle: 'No streaks yet',
    streakEmptyBody: 'Show up on two days in a row and you are on this board.',
    echoEmptyTitle: 'No reviews this period',
    echoEmptyBody: 'Answer a few cards and you are on this board for the period.',
  },

  badges: {
    earned: 'Earned · {month}',
    earnedLabel: 'Earned',
    locked: 'Locked',
    firstCorrection: 'First correction',
    streakDays: { one: '{formatted} day', other: '{formatted} days' },
    messagesSent: { one: '{formatted} message', other: '{formatted} messages' },
    tokensEarned: { one: '{formatted} token earned', other: '{formatted} tokens earned' },
    memberDays: { one: '{formatted} day a member', other: '{formatted} days a member' },
    corrections: { one: '{formatted} correction', other: '{formatted} corrections' },
    /**
     * The only badge whose wording ignores `threshold` — there is no number in
     * it. `origin.v1` is the only member of its kind, so this names it rather
     * than switching. Keep every translation under 40 characters: the label
     * goes straight into the share card's headline, which caps there.
     */
    earlyAdopter: 'Early Adopter',
    earnedOf: '{earned} of {total} earned',
    /**
     * Only somebody else's page can be empty: your own is the whole catalogue,
     * locked rows and all. Theirs is the earned half of it, which for a new
     * account is nothing at all — and a blank screen under a tile that said
     * "0 Badges" is the tile not working, as far as anyone tapping it knows.
     */
    emptyTitle: 'No badges yet',
    emptyBody: '@{handle} has not earned one yet. They are given for showing up and for helping.',
  },

  shared: {
    missingTitle: 'Nothing here',
    missingBody: 'No LangX profile answers to @{handle}.',
    ctaBody: '{name} practises languages on LangX. Join to say hello.',
    ctaLabel: 'Open LangX',
    inviteBody:
      '{name} invited you. Sign up and write to somebody, and you start with {total} tokens; {name} earns {activation} — up to {max} if you ever go paid. Free to join.',
  },

  shareProfile: {
    title: 'Share my profile',
    qrAccessibility: 'QR code for @{handle}',
    copied: 'Link copied',
    scanBody:
      'Anyone who scans this lands on your profile — in the app if they have it, in the browser if not.',
  },

  share: {
    cardTitle: 'Share as a picture',
    cardStreakCaption: 'day streak on LangX',
    cardBadgeCaption: 'badge earned on LangX',
    cardBody: 'Pick where it is going — the card is drawn to fit.',
    shapeStory: 'Instagram / TikTok story',
    shapeSquare: 'Instagram post',
    shapeWide: 'X / Twitter',
    justTheLink: 'Just the link',
    cardFailed: 'Could not make the picture. Sharing the link instead.',
    action: 'Share',
    copied: 'Link copied',
    copiedText: 'Text copied',
    profile: 'Share profile',
    profileMessage: 'Meet {name} on LangX: {url}',
    postMessage: '“{excerpt}” — {language} practice on LangX: {url}',
    streak: 'Share my streak',
    streakMessage: {
      one: '🔥 {count}-day streak on LangX. Practise with me: {url}',
      other: '🔥 {count}-day streak on LangX. Practise with me: {url}',
    },
    leaderboardMessage: {
      week: 'I’m #{rank} on LangX this week. Practise with me: {url}',
      month: 'I’m #{rank} on LangX this month. Practise with me: {url}',
      year: 'I’m #{rank} on LangX this year. Practise with me: {url}',
      all: 'I’m #{rank} on LangX, all time. Practise with me: {url}',
    },
    badge: 'Share the {label} badge',
    badgeMessage: 'I earned the “{label}” badge on LangX. Practise with me: {url}',
  },

  linkDevice: {
    title: 'Sign in on another device',
    body: 'Enter the code shown on the other screen, or scan it there.',
    warning:
      'Only approve a code you are looking at yourself. Anyone who gets it in gains full access to your account.',
    approve: 'Approve',
    deny: 'Deny',
    approved: 'Sign-in approved.',
    denied: 'Sign-in denied.',
    failed: 'That code is no longer valid.',
    waitingForDevice: 'Waiting for the other device to finish signing in…',
    thisDevice: 'this device',
    signOutDevice: 'Sign out',
    signOutOthers: 'Sign out everywhere else',
    signedOutDevice: 'Signed out.',
    unknownDevice: 'Unknown device',
    devicesTitle: 'Devices',
    approveTitle: 'Approve a sign-in',
    scan: 'Scan',
    typeCodePlaceholder: 'Type the code',
    whereSignedIn: 'Where you are signed in',
  },

  scan: {
    title: 'Scan a code',
    body: 'Point the camera at the sign-in code on your computer, or at a friend’s profile code.',
    permissionTitle: 'Camera access needed',
    permissionBody: 'LangX needs the camera to read a code. Nothing is recorded.',
    allow: 'Allow the camera',
    openSettings: 'Open Settings',
    unknown: 'That is not a LangX code.',
    webOnly:
      'Scanning needs your phone’s camera. Open LangX on your phone and tap Scan a code in Settings.',
    typeInstead: 'Type the code instead',
  },

  qrSignIn: {
    qrAccessibility: 'QR code for signing in',
    expired: 'The code expired.',
    failed: 'Could not start. Try again.',
    webOnly: 'This is for signing in on a computer. You are already on your phone.',
    bodyScan:
      'On a phone where you are already signed in, open {path} and point it here. Or type the code.',
    scanPath: 'Me → Settings → Scan a code',
    orEnterCode: 'Or enter this code',
    expiresIn: 'Expires in {time}',
    newCode: 'Get a new code',
  },

  viewers: {
    title: 'Who viewed your profile',
    seeWho: 'See who they are',
    emptyTitle: 'No visitors yet',
    emptyBody: 'Filling in your profile helps.',
    /** A visitor without an account: no name exists, so the row says what it is. */
    guest: 'Guest',
    weekSummary: {
      one: '{count} visit in the last week.',
      other: '{count} visits in the last week.',
    },
    seeWhoWith: 'See who with {plan}',
    unlockBody: 'Names and profiles, plus incognito browsing for you.',
    weekPeople: {
      one: '{count} person in the last week.',
      other: '{count} people in the last week.',
    },
    /** Visits by the same person that day; shown only from the second one. */
    repeat: '×{count}',
  },

  blocked: {
    title: 'Blocked people',
    unblock: 'Unblock',
    unblockConfirm: 'Unblock {name}? You will both be visible again.',
    unblocked: '{name} is unblocked.',
    emptyText: 'Nobody is blocked. Neither of you appear in the other’s lists while a block is on.',
  },

  paywall: {
    screenTitle: 'Plans',
    everythingInPro: 'Everything in {plan}',
    restorePurchases: 'Restore purchases',
    partOf: 'is part of',
    unlimitedChats: 'Unlimited new chats',
    unlimitedChatsBody: '{count} a day on the free plan.',
    welcomePack: 'A welcome pack',
    welcomePackBody:
      'A profile frame and two streak freezes to start with. {plan} brings the full set.',
    advancedFilters: 'Advanced filters',
    boostedProfile: 'Boosted profile',
    boostedProfileBody:
      'Shown in the Boosted strip above the Discover list, to everyone whose languages match yours. On by default; switch it off in Settings.',
    boostedProfileFirst: 'Boosted to the front',
    boostedProfileFirstBody: 'Polyglot profiles lead the Boosted strip, ahead of Fluent.',
    sendTranslation: 'Send in their language',
    sendTranslationBody: 'Write in yours; both go, so they read you without guessing.',
    deckExport: 'Take your phrases with you',
    deckExportBody:
      'Export one conversation’s saved phrases, or every card you have saved, as a file. It opens in Anki.',
    advancedFiltersBody: 'Search for a specific gender, and by city.',
    translationQuota: 'Translate as much as you need',
    translationQuotaBody: '{count} translations a day — far more than a conversation uses.',
    learningLanguages: 'More languages at once',
    learningLanguagesBody: 'Learn {count} languages side by side, not one.',
    whoViewed: 'Who viewed you',
    whoViewedBody: 'Not just the count — see who they are.',
    incognito: 'Incognito browsing',
    incognitoBody: 'Look at profiles without leaving a trace.',
    nearby: 'Nearby',
    nearbyBody:
      'Sort discovery by distance. Needs your own approximate location — rounded before it is stored, and shown to others only as a rough distance.',
    copilot: 'AI copilot',
    copilotBody: 'Help composing and understanding messages as you write them.',
    quotaNotice:
      'You’ve used today’s {count} new chats. You can still reply to everything you receive, with no limit.',
    manageNotice: 'You’re on {plan}. Manage or cancel it in your store account.',
    lifetimeNotice: 'You have {plan} for life. Nothing renews and nothing is charged.',
    lifetimeKept: '{plan} for life stays yours. If {plus} ever ends, you go back to it.',
    includedIn: 'Included in {plan}',
    upgradeNotice:
      'Upgrading from {plan}: the store charges only the difference for the rest of your current period, and {plan} ends.',
    upgradeWeb:
      'Your {plan} plan was bought on the web. Change it in the billing portal — unused time is refunded.',
    changePlan: 'Change plan',
    currentPlan: 'Your current plan',
    upgradeElsewhere:
      'Your {plan} plan was bought through {store}. Change it there, so you are not charged twice.',
    storeIos: 'the App Store',
    storeAndroid: 'Google Play',
    storeWeb: 'the web',
    purchaseFailed: 'That purchase did not go through. Nothing was charged.',
    purchaseUnavailable: 'Purchasing is unavailable on this device.',
    nothingToRestore: 'Nothing to restore on this device.',
    noPlans: 'No plans are available right now.',
    notSetUp: 'Purchasing is not set up on this platform yet.',
    legal:
      'Subscriptions renew automatically until cancelled. Cancel any time from your Apple or Google account — cancelling stops the next renewal and keeps access until the current period ends.',
    trialTerms: {
      one: '{count} day free, then {price} {period}',
      other: '{count} days free, then {price} {period}',
    },
    perMonth: 'a month',
    perYear: 'a year',
    perLifetime: 'once',
    terms: 'Terms',
    privacy: 'Privacy',
    monthly: 'Monthly',
    yearly: 'Yearly',
    lifetime: 'One-off',
    headline: 'Go further',
    headlineBody:
      'Corrections and replies stay unlimited on every plan. Paying removes the other limits.',
    yearlySaving: 'Yearly · save {percent}%',
    savePercent: 'Save {percent}%',
    savingA11y: '{price} a month on the monthly plan. Yearly saves {percent}%.',
    billingPeriod: 'Billing period',
    start: 'Start {plan}',
    continueFree: 'Continue free',
    perMonthBilledYearly: 'a month · billed yearly',
  },

  pickers: {
    searchCountries: 'Search countries',
    noCountryMatch: 'No country matches “{query}”',
    searchLanguages: 'Search {count} languages',
  },

  weekly: {
    messages: 'Messages',
    summary: 'This week: {messages} and {corrections}.',
  },

  /*
   The Apple Watch app, whose words cannot come from `t()` at runtime: they are
   drawn by Swift on a second device. `scripts/generate-xcstrings.ts` copies
   the keys listed in `src/i18n/nativeKeys.ts` out of these catalogues into an
   Apple string catalogue the watch target compiles. So this block is still the
   one source of truth â it simply reaches the watch by a different road.
  */
  watch: {
    complication: 'Watch face',
    showsUnread: 'Unread',
    showsStreak: 'Streak',
    /*
     The Wear tile's two words, and the tile's alone. The app's own screen
     lists recent conversations and borrows `tabs.chats` and
     `chats.emptyTitle` for its title and empty state; a tile answers "how
     many are waiting", which is still this question.
    */
    unread: 'Unread',
    nothingUnread: 'Nothing unread',
    openOnPhone: 'Open LangX on your phone',
    phoneNotReachable: 'Phone not reachable',
    reply: 'Reply',
    sending: 'Sending…',
    sent: 'Sent',
    notSent: 'Not sent',
    loading: 'Loading…',
  },

  /*
   The widget gallery: the name under each widget and the line under that.

   These are the only widget strings that exist. Everything a widget *draws*
   is a word the app already wrote into the snapshot, which is how three
   families ship in eight languages without a catalogue — but the gallery is
   drawn by WidgetKit before the snapshot is read, so these eight have to
   travel the same road the watch's words do.
  */

  /*
   What the Shortcuts app, the Action Button and the Control Centre call these
   actions. Drawn by Apple rather than by us, so they travel the same road the
   watch's words do — `nativeKeys.ts`, then the generator, then a catalogue the
   app target now carries for the first time.
  */
  intents: {
    openEcho: 'Open Echo',
    openEchoDetail: 'Go straight to the cards due today.',
    openChats: 'Open my messages',
    openChatsDetail: 'Go straight to the chat list.',
    openConversation: 'Open a chat',
    openConversationDetail: 'Go straight to the conversation with somebody you are talking to.',
    conversationType: 'Conversation',
    conversationParameter: 'Chat with',
  },
  widget: {
    faceDetail: 'Your streak, or what is waiting, on the watch face.',
    streakName: 'Streak',
    streakDetail: 'Your run of days. Dim until today counts.',
    todayName: 'Today',
    todayDetail: 'Streak, unread and cards due, in one row.',
    activityName: 'Activity',
    activityDetail: 'Your practice, one square a day.',
    glanceName: 'Glance',
    glanceDetail: 'Streak and unread, for the Lock Screen and StandBy.',
    exchangeStartsIn: 'Starts in',
    exchangeEndsIn: 'Ends in',
  },
} as const

export type EnMessages = typeof en
