/**
 * Every word in the operator panel.
 *
 * **English, and no locale anywhere near it** — the same sentence
 * `apps/api/src/routes/operatorPage.ts` carries, because this is the same
 * surface moved inside the app. Every other screen this app draws is read by
 * the person it is about; this one is read by us.
 *
 * So it is deliberately *not* in `src/i18n/messages/en.ts`. A key there is a
 * key in eight catalogues, and "Suspend permanently" is not a sentence worth
 * translating seven times — but the real cost is the other direction:
 * operator vocabulary would ship in everybody's bundle and land in the
 * Settings search index, where somebody would eventually find "Suspend" while
 * looking for something else.
 *
 * It lives in `src/lib/` because that is the only directory the mobile vitest
 * config can load (see `apps/mobile/vitest.config.ts`), and
 * `adminStrings.test.ts` asserts both halves of this decision: that nothing is
 * missing here, and that no admin screen reaches for `t()`. The lint rule in
 * `eslint.config.mjs` refuses the import outright.
 *
 * If you are here to "finish the translations": this is finished.
 */
/**
 * One decimal, and an em dash rather than a `0%` when there is nothing to take
 * a share of. Here rather than in a screen because the sentences that carry a
 * percentage are here, and a rate formatted two ways on one dashboard is a
 * reader wondering which one is rounded.
 */
export function adminPercent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—'
}

export const ADMIN = {
  entryRow: 'Operator panel',

  warning: 'Operator surface. English only. What you do here affects live accounts.',

  home: {
    title: 'Operator',
    reports: 'Reports',
    appeals: 'Appeals',
    feedback: 'Bug reports & ideas',
    broadcast: 'Broadcast',
    users: 'Find someone',
    system: 'System',
    waiting: 'waiting',
    sections: {
      queue: 'Waiting',
      audience: 'People',
      talking: 'Conversation',
      languages: 'Languages',
      funnel: 'Funnel',
      money: 'Plans & tokens',
    },
    joinedToday: 'Joined today',
    joinedWeek: 'Joined this week',
    activeToday: 'Active today (UTC)',
    seenWeek: 'Seen this week',
    profiles: 'Profiles',
    messages: 'Messages',
    corrections: 'Corrections',
    languageCount: 'Languages',
    pro: 'Pro',
    proPlus: 'Pro+',
    free: 'Free',
    paidShare: (paid: number, total: number) =>
      `${paid} of ${total} members are paying · ${adminPercent(paid, total)}`,
    poolYesterday: 'Yesterday’s pool (UTC)',
    poolPaid: 'paid',
    poolDistributed: 'distributed',
    poolNone: 'No pool has run yet.',
    builds: 'Builds',
    failedToLoad: 'Could not load the dashboard.',

    /** The live card at the top: who is in the app at this moment. */
    live: {
      badge: 'LIVE',
      online: 'in the app now',
      window: (minutes: number) => `Anyone seen in the last ${minutes} minutes`,
      peak: (n: number) => `peak ${n}`,
      hourAgo: '60 min ago',
      now: 'now',
      /** Before the first minute has been sampled, and after a restart. */
      warmingUp: 'The first minute is still being recorded.',
      /** The card opens the list of who those people are. */
      seeWho: 'Tap to see who',
    },

    /**
     * Which clock the days on this screen turn over on.
     *
     * Printed rather than assumed: most of the strips are cut in the
     * operator's own zone and three of them cannot be — `Active each day`,
     * the assistant's calls and the pool are UTC by construction, and the
     * note at the top of `modules/admin/stats.ts` says why. An unmarked UTC
     * column under a local date is the bug this pair of strings exists to
     * stop: read in Toronto, it put today's numbers under tomorrow's label.
     */
    daysIn: (zone: string) => `Days turn over in ${zone}`,

    /** Charts. Each is a single series, so each says what it plots. */
    charts: {
      activeDaily: 'Active each day',
      activeDailyNote: 'UTC days',
      newMembers: 'Joined each day',
      messagesDaily: 'Messages each day',
      correctionsDaily: 'Corrections each day',
      tokensDaily: 'Tokens awarded each day',
      lastDays: (days: number) => `last ${days} days`,
      lastWeek: 'last 7 days',
    },

    streaks: {
      longest: 'Longest streak',
      active: 'On a streak now',
    },

    languages: {
      learning: 'Being learned',
      native: 'Spoken natively',
      none: 'Nobody has listed one yet.',
    },

    /** Install → onboarding → first message → paywall, from PostHog. */
    funnel: {
      lastMonth: 'Last 30 days',
      allTime: 'All time',
      top: 'the top of the funnel',
      ofPrevious: (percent: string) => `${percent} of the step above`,
      loading: 'Asking PostHog…',
      none: 'No events in this window.',
      unconfigured:
        'POSTHOG_QUERY_API_KEY is not set on this instance, so there is no funnel here. It is a read key, separate from the one the purge uses — see .env.example. pnpm insight asks the same question from a laptop.',
      refused:
        'PostHog refused the key. It needs query:read on this project, and PostHog answers 403 rather than 401 for one it does not accept.',
      unreachable: 'PostHog did not answer. Nothing else on this screen is affected.',
      failed: 'Could not reach the funnel.',
    },
  },

  reports: {
    title: 'Reports',
    tabs: { open: 'Open', reviewing: 'Reviewing', actioned: 'Actioned', dismissed: 'Dismissed' },
    empty: 'Nothing waiting.',
    reportedBy: 'reported by',
    aboutPost: 'About a post',
    otherReports: (n: number) => `${n} other report${n === 1 ? '' : 's'} against this account`,
    details: 'What they wrote',
    noDetails: 'No details were given.',
    post: 'The post',
    postHidden: 'Hidden. Nobody can see it, its author included.',
    account: 'The account',
    inForce: 'Already suspended — deciding again replaces that.',
    hide: 'Hide this post',
    unhide: 'Show it again',
    suspendDays: 'Suspend for N days',
    suspendPermanent: 'Suspend permanently',
    dismiss: 'Dismiss the report',
    days: 'Days',
    confirmSuspend: (who: string, days: number) => `Suspend ${who} for ${days} days?`,
    confirmPermanent: (who: string) => `Suspend ${who} permanently?`,
    permanentAgain: 'This one does not expire. Type the handle to confirm.',
    confirmDismiss: 'Dismiss this report? Nothing changes on the account.',
    done: 'Decided.',
  },

  appeals: {
    title: 'Appeals',
    empty: 'No appeals waiting.',
    said: 'What they said',
    shorten: 'Shorten to N days',
    lift: 'Lift now',
    keep: 'Keep as is',
    confirmLift: (who: string) => `Lift the suspension on ${who}?`,
    confirmKeep: 'Keep the suspension? They are told nothing.',
  },

  feedback: {
    title: 'Bug reports & ideas',
    tabs: { open: 'Open', triaged: 'Paid', closed: 'Closed' },
    empty: 'Nothing waiting.',
    from: 'from',
    attachments: 'Attachments',
    openIssue: 'Open on GitHub',
    amount: 'Tokens',
    pay: (amount: number) => `Pay ${amount} tokens`,
    confirmPay: (amount: number, who: string) =>
      `Pay ${amount} tokens to ${who}? This cannot be undone.`,
    paid: (amount: number) => `Paid ${amount} tokens.`,
    alreadyPaid: 'This report has already been paid.',
    close: 'Close without paying',
    closeReason: 'Why',
    closeReasons: {
      fixed: 'Fixed',
      shipped: 'Shipped',
      wontfix: 'Won’t fix',
      duplicate: 'Duplicate',
      invalid: 'Not a bug',
    },
    note: 'Note',
  },

  broadcast: {
    title: 'Broadcast',
    newTitle: 'New broadcast',
    slug: 'Name',
    slugHint: 'Lower case, digits and dashes. It is the id that stops it sending twice.',
    body: 'Message (English)',
    bodyHint: 'Everyone who speaks another language gets this unless a translation is added.',
    audience: (n: number) => `${n} people`,
    createDraft: 'Create draft',
    edit: 'Edit the message',
    save: 'Save',
    edited: 'Saved. Send it to yourself again — the old test was of the old words.',
    editTranslated:
      'This one has translations, which are authored in files. Edit those and run the announcement script, or delete this draft and start again.',
    picture: 'Picture',
    pictureHint:
      'One image, above the words, in the same message. Everyone gets this one unless the files carry a translated version.',
    addPicture: 'Add a picture',
    replacePicture: 'Replace the picture',
    removePicture: 'Remove the picture',
    pictureAttached:
      'Picture saved. Send it to yourself again — the old test was of the old message.',
    pictureFailed: 'That picture did not upload.',
    picturePermission: 'LangX needs permission to reach your photos.',
    history: 'Past broadcasts',
    people: 'People',
    sent: 'Sent',
    state: 'Status',
    empty: 'No broadcasts yet.',
    status: {
      draft: 'Draft',
      queued: 'Queued',
      sending: 'Sending',
      paused: 'Paused',
      done: 'Sent',
    },
    test: 'Send it to me first',
    tested: 'Sent to you. Check the thread and the notification.',
    testFirst: 'Send it to yourself first. Nothing can be armed until somebody has read it here.',
    confirmPrompt: (n: number) => `Type ${n} to confirm`,
    confirmHint: 'The number of people this goes to.',
    start: 'Start sending',
    confirmStart: (n: number) =>
      `Send to ${n} people, from @langx? Messages already delivered cannot be recalled.`,
    pause: 'Stop sending',
    resume: 'Carry on',
    deleteDraft: 'Delete draft',
    confirmDelete: 'Delete this draft?',
    progress: (sent: number, total: number) => `${sent} of ${total}`,
    failed: (n: number) => `${n} failed`,
    stoppedNote: 'Stopped. What has already gone cannot be recalled.',
  },

  users: {
    title: 'Find someone',
    search: 'Handle, user id or email',
    notFound: 'Nobody by that name or address.',
    joined: 'Joined',
    lastSeen: 'Last seen',
    never: 'never',
    build: 'Build',
    plan: 'Plan',
    email: 'Email',
    unverified: 'unverified',
    suspended: 'Suspended',
    tokensFrozen: 'Earning frozen',
    unfreeze: 'Unfreeze earning',
    unfrozen: 'Earning unfrozen.',
    signOut: 'Sign out everywhere',
    confirmSignOut: (who: string) => `Sign ${who} out of every device?`,
    signedOut: (n: number) => `${n} session${n === 1 ? '' : 's'} ended.`,
    message: 'Message from @langx',
    messageHint: 'One way — they cannot reply. Say where a reply should go.',
    send: 'Send',
    sent: 'Sent.',
    suspend: 'Suspend',
    lift: 'Lift suspension',
    reason: 'Reason',
    counts: 'Reports & blocks',
    reportsAgainst: 'against',
    reportsFiled: 'filed',
    blockedBy: 'blocked by',
    history: 'What we have done',
    noHistory: 'Nothing yet.',
  },

  online: {
    title: 'In the app now',
    empty: 'Nobody is in the app right now.',
    /**
     * Everybody on this screen was seen inside the five-minute window, so the
     * distance from now is the whole story and a clock time would be one more
     * subtraction to do by eye.
     */
    seen: (seconds: number) =>
      seconds < 60 ? `seen ${seconds}s ago` : `seen ${Math.floor(seconds / 60)}m ago`,
    /** A guest has no display name and a synthetic handle, so the row says what it is. */
    guest: 'guest',
  },

  members: {
    title: 'Subscribers',
    tabs: { pro: 'Pro', proPlus: 'Pro+' },
    empty: 'Nobody is on this plan.',
    renews: 'renews',
    ends: 'ends',
    forever: 'no expiry',
    trial: 'trial',
    since: 'since',
  },

  diagnose: {
    discovery: 'Why Discover looks the way it does',
    discoveryHint: 'Each row is the one above it, narrowed once more.',
    matches: (n: number) => `${n} people match right now`,
    notDiscoverable: 'They have turned themselves off in Discover.',
    languages: 'Languages',
    push: 'Notifications',
    noDevices: 'No device has ever registered for push.',
    deviceOff: 'Notifications switched off on this phone',
    prefs: 'Switches',
    suppressed: 'No mail can reach this address',
    legacy: 'Coming back from v1',
    staged: 'Old data is staged',
    reserved: 'Handle was reserved',
    restored: 'Restored',
    nothingStaged: 'Nothing staged under either handle.',
  },

  system: {
    title: 'System',
    jobs: 'Scheduled work',
    jobNever: 'never run',
    jobFailed: 'last run failed',
    runs: (n: number) => `${n} runs`,
    suppressions: 'Addresses no mail may go to',
    purge: 'Waiting to be purged',
    purgeAccounts: 'accounts',
    purgeAnalytics: 'analytics rows',
    assistant: 'Copilot calls today (UTC)',
    campaigns: 'Email campaigns',
    config: 'Config',
    maintenance: 'Maintenance',
    maintenanceOn: 'ON',
    maintenanceOff: 'off',
    readOnly:
      'Everything else is read only. The kill switch is scripts/maintenance.ts — a panel served by the API cannot turn the API off.',
    minVersion: 'Minimum version',
    flags: 'Flags',
    latestVersion: 'Latest version',
    raiseBanner: 'Raise the update banner',
    raiseBannerHint:
      'The version now live in the stores. Everyone on an older build gets a dismissible banner offering the store. Nothing is blocked — that is Minimum version, and it is still a script.',
    versionPlaceholder: 'e.g. 2.3',
    set: 'Set',
    setDone: (platform: string, version: string) => `Latest ${platform} version is now ${version}`,
  },

  common: {
    back: 'Back',
    cancel: 'Cancel',
    confirm: 'Confirm',
    failed: 'That did not work',
    loading: 'Loading…',
  },
} as const
