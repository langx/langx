# Newsletter notes

The editorial half of the monthly recap — what shipped, in the writer's own
words. One file per month, `YYYY-MM.ts`, registered in `index.ts`.

The numbers in the recap are computed per reader and always sent. This is the
part somebody writes, and a month with no file simply has no editorial block.

## How a month's note gets here

1. **Drafted.** A scheduled routine runs on the 27th: it reads
   `git log --merges` since the last note, the GitHub releases in the window
   and the `docs/decisions.md` entries added that month, writes
   `YYYY-MM.ts` in English, translates it into the other seven, registers it
   in `index.ts`, and opens a pull request called `Newsletter 2026-10` whose
   body carries the rendered English.
2. **Reviewed.** The PR notification is the ping; the rendering is in the body.
   Edit the English in the PR — the routine re-translates from whatever the
   English ends up being, because the typed catalogue will not compile
   otherwise.
3. **Approved by merging.** No merge, no note. Nothing is ever sent on
   anybody's behalf by the routine.
4. **Deployed.** `fly deploy -a langx-api`, as always. The pass sends on the
   first of the month at 10:00 on each reader's own clock, or any of the six
   days after — so a deploy that slips does not skip a month.

## Writing one by hand

```ts
// apps/api/src/email/newsletters/2026-10.ts
import type { LocalizedNote } from './index'

export const note: LocalizedNote = {
  en: {
    headline: 'What shipped in October',
    items: [{ title: 'Sign in with Apple', body: 'Two taps, no password.' }],
    note: 'Reply to this email if something feels off — it reaches a human.',
  },
  tr: { headline: 'Ekimde neler çıktı', items: [/* … */] },
}
```

Then add it to `NOTES` in `index.ts`. English is required; every other
language falls back to it, which is what makes a half-translated month
harmless rather than a compile error.

Keep it to three or four items. This is the part people skim.
