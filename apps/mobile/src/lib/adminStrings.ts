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
    sections: { queue: 'Waiting', audience: 'People', money: 'Plans & tokens' },
    joinedToday: 'Joined today',
    joinedWeek: 'Joined this week',
    activeToday: 'Active today',
    seenWeek: 'Seen this week',
    profiles: 'Profiles',
    messages: 'Messages',
    pro: 'Pro',
    proPlus: 'Pro+',
    free: 'Free',
    poolYesterday: 'Yesterday’s pool',
    poolPaid: 'paid',
    poolDistributed: 'distributed',
    poolNone: 'No pool has run yet.',
    builds: 'Builds',
    failedToLoad: 'Could not load the dashboard.',
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
    assistant: 'Copilot calls today',
    campaigns: 'Email campaigns',
    config: 'Config',
    maintenance: 'Maintenance',
    maintenanceOn: 'ON',
    maintenanceOff: 'off',
    readOnly:
      'Read only. The kill switch is scripts/maintenance.ts — a panel served by the API cannot turn the API off.',
    minVersion: 'Minimum version',
    flags: 'Flags',
  },

  common: {
    back: 'Back',
    cancel: 'Cancel',
    confirm: 'Confirm',
    failed: 'That did not work',
    loading: 'Loading…',
  },
} as const
