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
import { COPILOT_RULES, type ReportReason } from '@langx/shared'

/**
 * One decimal, and an em dash rather than a `0%` when there is nothing to take
 * a share of. Here rather than in a screen because the sentences that carry a
 * percentage are here, and a rate formatted two ways on one dashboard is a
 * reader wondering which one is rounded.
 */
export function adminPercent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—'
}

/**
 * The first warning for a reported account, in the shape the hand-written
 * ones of 28 Sept took. @langx is one way, so it names where a reply goes.
 */
function warning(what: string): string {
  return `Hi, this is the LangX Team.

We've received a report that your account ${what}. This goes against our community rules, so this is a warning.

Please review our Terms: https://langx.io/terms-conditions

If it happens again, your account may be suspended. Questions: hi@langx.io`
}

/**
 * One warning per report reason, which the report screen fills in from the
 * report and the search-box screen offers as buttons. In English whatever the
 * reader's language, like everything typed into the panel. Keyed by the
 * reason, so a reason added to `REPORT_REASONS` does not compile without one.
 */
export const WARNINGS: Record<ReportReason, string> = {
  spam: warning('has been sending spam or unwanted promotion'),
  scam: warning('has been asking other users for money'),
  harassment: warning('has been harassing other users'),
  hate_speech: warning('has been attacking people for who they are'),
  inappropriate_content: warning('has been sharing inappropriate content'),
  fake_profile: warning('is using a fake or misleading profile'),
  underage: `Hi, this is the LangX Team.

We've received a report that you may be under 16. LangX is only for people aged 16 and over.

If this is a mistake, please write to hi@langx.io. Otherwise your account may be suspended.`,
  other: warning('has broken our community rules'),
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
    giftCodes: 'Gift codes',
    measure: 'Measurement',
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
    joinedMonth: 'Joined in 30 days',
    activeToday: 'Active today',
    seenMonth: 'Seen in 30 days',
    profiles: 'Profiles',
    messages: 'Messages',
    corrections: 'Corrections',
    languageCount: 'Languages',
    pro: 'Pro',
    paid: 'Paid',
    gifted: 'Gifted',
    free: 'Free',
    totalMembers: 'Total',
    paidShare: (paid: number, total: number) =>
      `${paid} of ${total} members are paying · ${adminPercent(paid, total)}`,
    poolYesterday: 'Yesterday’s pool',
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
      dayAgo: '24 h ago',
      now: 'now',
      /** Before the first minute has been sampled, and after a restart. */
      warmingUp: 'The first minute is still being recorded.',
      /** The card opens the list of who those people are. */
      seeWho: 'Tap to see who',
    },

    /**
     * Which clock the days on this screen turn over on. Printed rather than
     * assumed: read at 21:00 in Toronto, "today" here is already tomorrow.
     */
    allUtc: 'All days and times are UTC',

    /** Charts. Each is a single series, so each says what it plots. */
    charts: {
      activeDaily: 'Active each day',
      newMembers: 'Joined each day',
      messagesDaily: 'Messages each day',
      correctionsDaily: 'Corrections each day',
      tokensDaily: 'Tokens awarded each day',
      lastDays: (days: number) => `last ${days} days`,
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
    aboutComment: 'About a comment',
    aboutTestimonial: 'About a review',
    otherReports: (n: number) => `${n} other report${n === 1 ? '' : 's'} against this account`,
    details: 'What they wrote',
    noDetails: 'No details were given.',
    post: 'The post',
    noCaption: '(no caption)',
    postHidden: 'Hidden. Nobody can see it, its author included.',
    account: 'The account',
    inForce: 'Already suspended — deciding again replaces that.',
    hide: 'Hide this post',
    unhide: 'Show it again',
    comment: 'The comment',
    commentReply: 'The comment — a reply in a thread',
    commentUnder: (post: string) => `Under the post: ${post}`,
    commentRemoved: 'Its author has since removed the words; the replies to it remain.',
    commentHidden: 'Hidden. Nobody can see it, its author included.',
    hideComment: 'Hide this comment',
    testimonial: (subject: string) => `The review, on ${subject}'s profile`,
    testimonialOwnerHidden: (subject: string) =>
      `${subject} has hidden it from their profile; they can show it again.`,
    testimonialRemoved:
      'Removed. Nobody sees it on the profile, and neither side can bring it back.',
    hideTestimonial: 'Remove this review',
    message: 'The message',
    noMessageText: '(no text)',
    messageDeleted: 'Its sender deleted it for everyone, and its files with it.',
    viewOnce: (replay: boolean, opens: number) =>
      `Sent view-once${replay ? ', with one replay' : ''}. Opened ${opens} time${opens === 1 ? '' : 's'}. The person who received it can no longer see it; it is kept for this.`,
    viewOnceScreenshot: 'They tried to take a screenshot while it was open; the app blocked it.',
    thread: 'Their conversation',
    threadHint: 'The last messages before the report, oldest first. Nothing said after it.',
    threadReported: 'reported',
    threadDeleted: '(deleted for everyone)',
    threadFiles: (type: string, count: number) => `(${type}${count > 1 ? `, ${count} files` : ''})`,
    suspendDays: 'Suspend for N days',
    suspendPermanent: 'Suspend permanently',
    dismiss: 'Dismiss the report',
    days: 'Days',
    confirmSuspend: (who: string, days: number) => `Suspend ${who} for ${days} days?`,
    confirmPermanent: (who: string) => `Suspend ${who} permanently?`,
    permanentAgain: 'This one does not expire. Type the handle to confirm.',
    confirmDismiss: 'Dismiss this report? Nothing changes on the account.',
    done: 'Decided.',
    reporter: 'Who reported it',
    rewardAmount: 'Tokens',
    reward: (amount: number) => `Thank them with ${amount} tokens`,
    confirmReward: (amount: number, who: string) =>
      `Give ${who} ${amount} tokens? They get a push and a message from @langx. This cannot be undone.`,
    rewarded: (amount: number) => `Thanked with ${amount} tokens.`,
    alreadyRewarded: 'This report has already been rewarded.',
    /*
     * The ladder: warn, then suspend for some days, then for good. The
     * warning is the first rung, so it sits above the suspensions.
     */
    warn: 'Warn first',
    warnHint:
      'From @langx, filled in for this reason — edit it if you like. Also mailed to their verified address. It closes the report and stays on it, and on every later report against them.',
    sendWarning: 'Send the warning',
    confirmWarn: (who: string) => `Warn ${who} from @langx? This closes the report.`,
    warned: (date: string) => `Warned on ${date}. Next step: suspend for some days.`,
    alreadyWarned: 'This report has already been warned about.',
    warnedBefore: (n: number) =>
      `Already warned ${n} time${n === 1 ? '' : 's'} — suspend rather than warn again:`,
    warnedRow: (date: string, reason: string) => `${date} · ${reason}`,
    warnedTag: 'Warned',
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
    reply: 'Write back',
    replyLabel: 'Message from @langx, also emailed',
    sendReply: 'Send message and email',
    confirmReply: (who: string) => `Send this to ${who} in the @langx chat and by email?`,
    replied: (emailed: boolean) =>
      emailed ? 'Sent, and emailed.' : 'Sent in the app. The email did not go.',
    repliedAt: (date: string) => `Answered ${date}`,
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
    pollAnswers: (n: number) => `Answers (${n})`,
    pollOption: (label: string, n: number) => `${label} · ${n}`,
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
    removeAvatar: 'Remove profile photo',
    confirmRemoveAvatar: (who: string) =>
      `Remove ${who}'s profile photo? The file is deleted and cannot be restored.`,
    avatarRemoved: 'Profile photo removed.',
    message: 'Message from @langx',
    messageHint:
      'One way — they cannot reply. Say where a reply should go. Also mailed to their verified address, so a suspended account still reads it.',
    presetsHint: 'Ready to send — tap one to fill the box, then edit if needed.',
    send: 'Send',
    sent: 'Sent.',
    sentAndEmailed: 'Sent, and emailed.',
    sentNotEmailed: 'Sent in the app. Not emailed — no verified address.',
    suspend: 'Suspend',
    lift: 'Lift suspension',
    reason: 'Reason',
    counts: 'Reports & blocks',
    moderation: 'Moderation',
    reportsAgainst: 'against',
    reportsFiled: 'filed',
    blockedBy: 'blocked by',
    history: 'What we have done',
    noHistory: 'Nothing yet.',
    copilot: {
      title: 'Copilot access',
      hint: `Uses Copilot when the switch is on, they are ${COPILOT_RULES.minimumAge}+, and they agree.`,
      allowed: 'Copilot allowed',
      revoked: 'Copilot access removed',
    },
    gift: {
      title: 'Give Pro',
      hint: 'A RevenueCat grant with an end date. They get a message from @langx, a push and a mail in their language.',
      months: (n: number) => `${n} month${n === 1 ? '' : 's'}`,
      note: 'Why (for the log — they never see it)',
      preview: (date: string) =>
        `Pro until ${date}, counted from the end of any gift they already have.`,
      subscribed:
        'They pay for a subscription. A gift does not stop that billing — it only carries Pro on until the date above if the subscription ends. Their message says so too.',
      lifetime: 'They hold Pro for life. There is nothing to add to that.',
      give: 'Give Pro',
      confirm: (who: string, span: string) => `Give ${who} ${span} of Pro?`,
      given: 'Pro given.',
      pending: 'Saved — RevenueCat did not answer, so the scheduler will retry it.',
      already: 'That gift was already given today.',
      list: 'Gifts',
      monthsShort: (n: number) => `${n} mo`,
      /** The streak's first rung is a week rather than months. */
      weeksShort: (n: number) => `${n} wk`,
      until: (date: string) => `until ${date}`,
    },
  },

  linked: {
    title: 'Linked accounts',
    hint: (days: number) =>
      `Accounts that signed in from the same network in the last ${days} days, or used the same phone. A network can be a household, a campus or a mobile carrier — a lead, not proof. A shared device is much stronger.`,
    empty: 'No other accounts share a network or device with this one.',
    truncated: (n: number) => `Showing the ${n} strongest links. There are more.`,
    network: 'same network',
    device: 'same device',
    suspended: 'suspended',
    age: (days: number) =>
      days < 1
        ? 'joined today'
        : days < 60
          ? `joined ${days}d ago`
          : days < 730
            ? `joined ${Math.floor(days / 30)}mo ago`
            : `joined ${Math.floor(days / 365)}y ago`,
    reports: (n: number) => `${n} open report${n === 1 ? '' : 's'}`,
    select: (handle: string) => `Select @${handle}`,
    selectAll: 'Select all',
    suspendSelected: (n: number) => `Suspend ${n} selected`,
    confirm: (n: number, days: number) =>
      `Suspend ${n} account${n === 1 ? '' : 's'} for ${days} days?`,
    confirmMessage:
      'Each one gets the usual notice and is logged on its own account. Operators, official accounts, you, and anyone already suspended are skipped.',
    done: (suspended: number, skipped: number) =>
      skipped === 0 ? `${suspended} suspended.` : `${suspended} suspended, ${skipped} skipped.`,
  },

  /**
   * The measurement screen. Every definition is printed where it is used,
   * because a rate whose denominator is a mystery cannot be compared with
   * anything — least of all with itself a month from now.
   */
  measure: {
    title: 'Measurement',
    intro:
      'Read from what the server already keeps, nothing more. Private: none of this belongs on a public page.',
    clocks:
      'Weeks start on the UTC Monday of the sign-up. A person’s Day 1, 7 and 30 are counted on their own calendar.',
    window: 'Weeks shown',
    weeks: (n: number) => `${n} weeks`,
    failedToLoad: 'Could not load the measurement.',
    truncated:
      'A ceiling was hit while reading, so these figures cover the most recent part of the window only.',
    generated: (time: string) => `Read at ${time} UTC. Kept for five minutes.`,
    /** "3 of 8" — who a rate is out of. */
    ratio: (count: number, whole: number) => `${count} of ${whole}`,
    duration: {
      underMinute: 'under a minute',
      minutes: (n: number) => `${n} min`,
      hours: (n: number) => `${n} h`,
      days: (n: number) => `${n} days`,
    },

    cohorts: {
      title: 'Sign-up cohorts',
      hint: (hours: number, conversations: number) =>
        `Return is being in the app on that exact day. Activated is ${conversations} two-way conversations within ${hours} hours of joining. Guests, official accounts and deleted accounts are left out. Under each rate is who it is out of: only people whose day has fully passed are counted.`,
      returnSource: (from: string) =>
        `Return is read from the streak calendar, which records a visit with nothing else in it from ${from}. Days before that are not measured.`,
      week: 'Week of',
      joined: 'Joined',
      day1: 'Day 1',
      day7: 'Day 7',
      day30: 'Day 30',
      activated: 'Activated',
      total: 'All weeks',
      nobody: 'Nobody joined in this window.',
    },

    firstMessages: {
      title: 'First messages',
      hint: (hours: number) =>
        `Conversations between two people, by the week they were opened. A message is judged once it is ${hours} hours old. Unanswered includes a reply that came later than that. @langx’s own messages are left out.`,
      medianNote:
        'The median covers conversations that got a reply, however late, so the newest weeks read faster than they will turn out to be.',
      week: 'Week of',
      opened: 'Opened',
      unanswered: (hours: number) => `No reply in ${hours} h`,
      outOf: (n: number) => `of ${n}`,
      never: 'Never answered',
      median: 'Median reply',
      total: 'All weeks',
      none: 'No conversations were opened in this window.',
    },

    refusals: {
      title: 'Limits people hit',
      hint: (days: number) =>
        `Every time someone was told they had run out, by which limit, over the last ${days} days — all the server keeps. Free and Pro accounts are both here. “Unknown” was recorded before the limit was.`,
      none: (days: number) => `Nobody was refused in the last ${days} days.`,
      people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
      kinds: {
        initiations: 'New conversations',
        translations: 'Translations',
        translationFairUse: 'Translations — fair-use ceiling',
        media: 'Photos, voice and video',
        echoCaptures: 'Echo cards kept',
        echoNewCards: 'Echo starter cards',
        echoVoices: 'Echo card read aloud',
        chatVoices: 'Message read aloud',
        transcripts: 'Voice note transcripts',
        copilot: 'Copilot answers',
        unknown: 'Unknown',
      },
    },

    heardAbout: {
      title: 'Where they heard of us',
      hint: (total: number) =>
        `The poll @langx sends every new account under the welcome. ${total} answered so far, all time — first answer only. Returning v1 accounts are not asked.`,
      none: 'Nobody has answered yet.',
      failedToLoad: 'Could not load the answers.',
      recent: 'Latest answers',
      options: {
        store: 'App Store or Google Play',
        search: 'Google or another search engine',
        ai: 'ChatGPT or another AI',
        friend: 'A friend',
        'tiktok-instagram': 'TikTok or Instagram',
        youtube: 'YouTube',
        'app-list': 'An app list or review site',
        other: 'Somewhere else',
      } as Record<string, string>,
    },

    notHere:
      'Not on this screen: paywall views and what was tapped on them, and installs. They live in PostHog.',
  },

  /** One person's money, on the account screen. */
  money: {
    title: 'Money timeline',
    hint: 'Gifts of Pro, what the store told us, and the fall back to free — in order, newest first.',
    notHere:
      'Paywall views and taps on them are in PostHog, not the server, so a quiet stretch here does not mean the paywall was never seen. The stored store events do not say whether a period was a free trial; each start shows how long the period it opened was instead.',
    empty: 'Nothing recorded: no gift, and no event from the store.',
    truncated: (n: number) =>
      `Showing the newest ${n} lines of at least one source. There are more.`,
    failed: 'Could not load the timeline.',
    now: {
      title: 'Right now',
      free: 'Free',
      pro: 'Pro',
      trial: 'in the free week',
      intro: 'on an introductory price',
      store: (store: string) => `via ${store}`,
      renews: 'renews',
      wontRenew: 'will not renew',
      until: (date: string) => `until ${date}`,
    },
    day: (days: number) =>
      days < 0 ? 'before joining' : days === 0 ? 'day of joining' : `day ${days} after joining`,
    sandbox: 'sandbox',
    period: (days: number) => `opens a ${days}-day period`,
    churn: 'Fell back to free',
    gift: {
      title: 'Gift of Pro',
      length: (months: number, weeks: number) => {
        const parts: string[] = []
        if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`)
        if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? '' : 's'}`)
        return parts.join(' and ') || 'no time'
      },
      sources: {
        admin: 'from an operator',
        streak: 'for a streak',
        referral: 'for invitations',
        code: 'from a gift code',
        welcome: 'the Pro Week',
      },
      statuses: {
        pending: 'waiting to be granted',
        granted: 'granted',
        failed: 'could not be granted',
        skipped: 'skipped',
      },
    },
    events: {
      INITIAL_PURCHASE: 'Subscription started',
      RENEWAL: 'Renewed',
      CANCELLATION: 'Cancelled',
      UNCANCELLATION: 'Auto-renew turned back on',
      EXPIRATION: 'Ended',
      BILLING_ISSUE: 'Billing problem',
      PRODUCT_CHANGE: 'Changed plan',
      NON_RENEWING_PURCHASE: 'One-off purchase',
      SUBSCRIPTION_PAUSED: 'Paused',
      TRANSFER: 'Moved between accounts',
      TEST: 'Test event',
    },
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
    empty: 'Nobody is on this plan.',
    renews: 'renews',
    ends: 'ends',
    forever: 'no expiry',
    trial: 'trial',
    gift: 'gift',
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
    bounced: 'bounced',
    complained: 'complained',
    unsubscribed: 'unsubscribed',
    purge: 'Waiting to be purged',
    purgeAccounts: 'accounts',
    purgeAnalytics: 'analytics rows',
    leaving: 'Why people left (purged, 30d · 90d)',
    leavingNone: 'Nobody who left gave a reason in the last 90 days.',
    assistant: 'Copilot calls today (UTC)',
    campaigns: 'Email campaigns',
    config: 'Config',
    maintenance: 'Maintenance',
    maintenanceOn: 'ON',
    maintenanceOff: 'off',
    readOnly:
      'Maintenance and the other flags are read only. The kill switch is scripts/maintenance.ts — a panel served by the API cannot turn the API off.',
    minVersion: 'Minimum version',
    flags: 'Flags',
    latestVersion: 'Latest version',
    raiseBanner: 'Raise the update banner',
    raiseBannerHint:
      'The version now live in the stores. Everyone on an older build gets a dismissible banner offering the store. Nothing is blocked — that is Minimum version, below.',
    versionPlaceholder: 'e.g. 2.3',
    set: 'Set',
    setDone: (platform: string, version: string) => `Latest ${platform} version is now ${version}`,
    forceUpdate: 'Force an update',
    forceUpdateHint:
      'After a breaking release. Anyone below this version sees "update to continue" on their next launch or return to the app, signed in or not, and cannot go on until they update. It cannot be above the latest version for the platform — set that first. Set 0.0.0 to lift it.',
    forceAboveLatest: (platform: string, latest: string) =>
      `Above the latest ${platform} version (${latest}). Raise that first.`,
    confirmForce: (platform: string, version: string) =>
      `Block every ${platform} build below ${version} until it updates?`,
    minDone: (platform: string, version: string) => `Minimum ${platform} version is now ${version}`,
    captcha: 'Bot check on sign-up',
    captchaHint:
      'Email sign-up, sign-in and password reset carry a Cloudflare Turnstile token from builds that have the widget, and a token that is sent is always checked. Requiring it also refuses requests with no token — which is every build older than the widget, so raise Minimum version to that build first. Needs TURNSTILE_SECRET_KEY on the API; without it nothing is checked either way.',
    captchaOn: 'required',
    captchaOff: 'checked when sent',
    captchaRequire: 'Require it',
    captchaRelax: 'Stop requiring it',
    confirmCaptcha: 'Refuse email sign-up, sign-in and reset from any build that sends no token?',
    captchaDone: (required: boolean) =>
      required ? 'The bot check is now required' : 'The bot check is checked only when sent',
  },

  /**
   * Codes worth months of Pro to anybody who types one into the paywall.
   * Time, never money off — the word "discount" does not belong here.
   */
  giftCodes: {
    title: 'Gift codes',
    hint: 'Anyone can redeem a code once from the paywall’s “Have a gift code?” link. It becomes a gift of Pro: a RevenueCat grant with an end date, and a message from @langx.',
    newTitle: 'New code',
    code: 'Code',
    codeHint:
      '3 to 32 letters, digits or dashes. Stored in capitals; people can type it in any case.',
    months: 'Months of Pro',
    monthsHint: 'Between 1 and 12.',
    maxRedemptions: 'Redemptions allowed',
    maxRedemptionsHint: 'Empty means no limit.',
    expiresAt: 'Last day (YYYY-MM-DD, UTC)',
    expiresAtHint: 'Empty means it never expires. It stops working at the end of that day.',
    note: 'Why (for the log — nobody redeeming it sees it)',
    create: 'Create code',
    created: 'Code created.',
    taken: 'That code already exists.',
    list: 'Codes',
    empty: 'No codes yet.',
    used: (used: number, max: number | null) =>
      max === null ? `${used} used · no limit` : `${used} of ${max} used`,
    monthsShort: (n: number) => `${n} mo`,
    until: (date: string) => `until ${date}`,
    noExpiry: 'no expiry',
    /** Whether it works right now: switched off wins over past its day. */
    state: (active: boolean, expired: boolean) =>
      !active ? 'Off' : expired ? 'Expired' : 'Active',
    deactivate: 'Switch off',
    activate: 'Switch on',
    confirmDeactivate: (code: string) =>
      `Switch ${code} off? Nobody can redeem it until it is switched on again. Nothing already given is taken back.`,
    switchedOff: 'Switched off.',
    switchedOn: 'Switched on.',
    redemptions: 'Who redeemed it',
    noRedemptions: 'Nobody yet.',
    deletedAccount: 'deleted account',
    createdOn: (date: string) => `Created ${date}`,
    notFound: 'No such code.',
  },

  /**
   * The design gallery: the tokens the app draws with, the current look's
   * beside v3's. A developer's page rather than an operator's, so it is only
   * reachable in a dev build with the debug panel on. Copy that a person
   * would read — the type ramp's sample lines — is real catalogue copy from
   * `src/components/gallery/GallerySamples.tsx`; these are the labels round it.
   */
  gallery: {
    entryRow: 'Design gallery',
    title: 'Design gallery',
    intro:
      'Every token the app draws with. It follows the app’s theme, so switch the theme to see the other scheme.',
    current: 'Current look',
    v3: 'v3',
    colors: {
      title: 'Colours',
      hint: 'The current look first, then v3’s set on its own ground. v3 keeps yellow and blue the same in both schemes.',
    },
    hues: {
      title: 'Partner hues',
      hint: 'One per partner, picked from their id, and the same on every screen. Ink on the hue; on a chip, the hue on ink.',
      sample: 'Aa',
    },
    type: {
      title: 'Type',
      hint: 'v3’s ramp. Each line is real app copy in the step it would use.',
      steps: {
        numeral: 'Numeral',
        display: 'Display',
        title: 'Title',
        headline: 'Headline',
        body: 'Body',
        callout: 'Callout',
        caption: 'Caption',
        label: 'Label',
        button: 'Button',
        buttonSmall: 'Button, small',
      },
      faces: {
        Nunito_900Black: 'Nunito 900',
        Nunito_800ExtraBold: 'Nunito 800',
        system: 'system 400',
      },
      /** Size over line height, the way the drawings write it: "44/46". */
      metrics: (size: number, line: number) => `${size}/${line}`,
    },
    radii: { title: 'Corners' },
    spacing: { title: 'Spacing', hint: 'Keyed by points. 16 is the screen’s side gutter.' },
    icons: { title: 'Icon sizes', hint: 'The glyph only; the touch target round it is bigger.' },
    elevation: {
      title: 'Elevation',
      hint: 'v3 is flat: a plane, or the scrim in front of it. Nothing has a shadow.',
      none: 'none',
      overlay: 'overlay',
    },
    motion: {
      title: 'Motion',
      hint: 'Tap a preset to play it. Under reduce motion each one is simply at its end.',
      reduced: 'Reduce motion is on, so nothing below moves.',
      press: 'Press and hold',
      pressScale: (scale: number) => `Press scale · ${scale}`,
      timing: (name: string, ms: number) => `${name} · ${ms} ms`,
      spring: (name: string) => `spring · ${name}`,
    },
    buttons: {
      title: 'Buttons',
      hint: 'Flat pills in sentence case. Every target is at least 44pt on iOS and 48dp on Android. Tap the first one to run loading, then success.',
      variants: 'Variants',
      sizes: 'Sizes',
      states: 'States',
      iconButtons: 'Icon buttons',
      pressable: 'PressableScale',
      pressableHint:
        'Press and hold: the face shrinks and the target does not. Under reduce motion it dims instead.',
      /** "primary · 56": the variant or size, and the face height in points. */
      spec: (name: string, face?: number) => (face ? `${name} · ${face}` : name),
      loading: 'loading',
      success: 'success',
      disabled: 'disabled',
      iconEnd: 'icon at the end',
      wraps: 'a long label wraps rather than truncating',
    },
    controls: {
      title: 'Controls',
      hint: 'The switch, the segmented control, the progress bar and the toast. All of them move; under reduce motion each is simply in its new state. A switch or a segment ticks once, on a change that a press caused.',
      toggles: 'Switch',
      toggleStates: 'waiting on the server, on and off · disabled, on and off',
      segmented: 'Segmented control',
      twoWay: 'two segments · 16pt',
      fourWay: 'four segments · the label step',
      band: 'more than one chosen: each its own pill',
      progress: 'Progress bar',
      progressHint: 'Tap to move it on a fifth.',
      steps:
        'Onboarding steps: drawn in StepProgress, not this bar — the launch path stays off Reanimated.',
      toast: 'Toast',
      toastHint:
        'Raises a real toast at the foot of the screen. Tap it, or wait, to watch it leave.',
      raise: 'Raise a toast',
      raiseWithAction: 'Raise one with an action',
    },
    game: {
      title: 'Gamification',
      hint: 'The v3 primitives, in every state. No shipped screen uses them yet. Copy is real catalogue copy.',
      reduced:
        'Reduce motion is on: the ring jumps, and the toast and the celebration do not move.',
      rings: 'ProgressRing',
      ringStates: 'empty · a third · two thirds · full, at sm 44 · md 58 · lg 84',
      ringToday: 'Today’s three: done, not yet, Echo’s on its tint',
      ringWeek: 'The first week, read out as “1 of 4”',
      ringPlay: 'Tap: a quarter more, then back to empty',
      flames: 'StreakFlame',
      flameSizes: 'solo · row, title, hero',
      flameOnHue: 'on a hue, in ink',
      flamePair: 'pair · in a row, and the celebration’s chip',
      toast: 'RewardToast',
      toastStill: 'drawn still',
      toastPlay: 'Play three',
      toastPlayHint: 'The second and third share a reason and arrive together, so they merge.',
      celebration: 'CelebrationSheet',
      celebrationStill: 'the card, drawn still',
      celebrationOpen: 'Open as a new event',
      celebrationAgain: 'Open the last event again',
      celebrationAgainHint:
        'The same event a second time: the card, without the motion or the haptic.',
      hero: 'HeroTile',
      heroStates: 'blue, with its action · a hue, without one',
      coach: 'CoachCard',
      coachStates: 'a glyph and a title · a drawing and no title',
      coachBack: 'Bring the dismissed cards back',
      empty: 'EmptyStateV3',
      emptyStates: 'chats · cards (secondary action) · people',
    },
  },

  /**
   * The Copilot lab: an operator trying Copilot on their own account, against
   * their own chats — the only way into it in the app until its screens
   * exist. What it asks is real: the consent sheet, the allowance, the cache.
   */
  copilot: {
    entryRow: 'Copilot lab',
    title: 'Copilot lab',
    hint: 'Copilot on your own account, in your own chats. Every answer the model writes is a real call: it spends one of your units and one of the day’s calls for everybody. An answer from the cache spends neither.',
    switchNote:
      'Turning it on for everybody is not on this screen. It is `scripts/maintenance.ts flag copilotEnabled true`, and only after the privacy policy and both store forms name the provider and a spend limit is set on the key.',
    service: 'Service',
    serviceOn: 'On — a key, and flags.copilotEnabled',
    serviceOff: 'Off — no key, or flags.copilotEnabled is off',
    access: 'Your account',
    accessOk: 'Can use it',
    accessAge: 'Off — under Copilot’s minimum age',
    accessOff: 'Off',
    consent: 'Consent',
    consentGiven: 'Given',
    consentMissing: 'Not given',
    left: 'Left today',
    leftValue: (remaining: number | null, limit: number | null) =>
      remaining === null || limit === null ? 'No limit' : `${remaining} of ${limit}`,
    showSheet: 'Show the consent sheet',
    withdraw: 'Withdraw consent',
    pick: 'Pick a chat',
    pickTitle: 'Try Copilot in',
    picked: (name: string) => `In the chat with ${name}`,
    sentence: 'Sentence to check',
    check: 'Check',
    replyIdeas: 'Reply ideas',
    explain: 'Explain the newest correction',
    noCorrection: 'No correction among the newest messages of this chat.',
    cached: 'From the cache — nothing spent',
    fresh: 'Written now',
    refused: (code: string, reason?: string) => `Refused: ${code}${reason ? ` (${reason})` : ''}`,
    allowedTitle: 'Allowed accounts',
    allowedEmpty: 'Nobody yet. Allow yourself or add an account above.',
    allowMe: 'Allow me',
    addLabel: 'Add an account',
    addPlaceholder: '@handle',
    addNone: 'No account with that handle.',
    notAllowed: 'Not on the list',
    allow: 'Allow Copilot',
    remove: 'Take Copilot away',
    allowedSince: (date: string) => `Since ${date}`,
    you: 'You',
    youAllowed: 'On the list',
    youNotAllowed: 'Not on the list. Being an admin does not count: use Allow me.',
    whoTitle: 'Who sees Copilot',
    whoRules: [
      'flags.copilotEnabled is on',
      'the API has a key',
      'the account is on the list above',
      `they are ${COPILOT_RULES.minimumAge} or older, by the exact birthday`,
      'they agreed to the current consent sheet, asked on their first tap',
    ],
    whoPartner: `On top of that, Explain and Reply ideas refuse a chat whose partner is under ${COPILOT_RULES.minimumAge}, so their words never reach the model.`,
  },

  common: {
    back: 'Back',
    cancel: 'Cancel',
    confirm: 'Confirm',
    failed: 'That did not work',
    loading: 'Loading…',
  },
} as const
