# ext-lab — the Playwright harness

78 throwaway scripts written while verifying v2 in a real browser, 28 August –
3 September 2026. They were written on a server that has since been
decommissioned and lived outside every checkout; moved into this repo on
5 September 2026 so they survive the next machine change. They are excluded
from lint and format checks and from the workspace — nothing here ships.

They are not a test suite. Each one was written to answer a single question
(does the swipe fire on touch, does the wallet render, is the tab bar there)
and most were superseded by the next one along — `verify-guest.mjs` through
`verify-guest5.mjs` are five passes at the same bug. Read them as a record of
how a thing was checked, and copy the pattern rather than running the file.

To run one: `node <file>.mjs`, with `playwright` resolvable and Chromium
installed. `chromium.launch({ args: ['--no-sandbox'] })` is in every file
because they ran as root; that flag is unnecessary elsewhere.

The ports they hardcode:

| Port   | What was on it                                                              |
| ------ | ----------------------------------------------------------------------------- |
| `8081` | the shared Expo web dev server (46 scripts)                                  |
| `8082` | the isolated verify stack's Expo, paired with an API on `4100`               |
| `4000` | the shared API                                                               |
| others | one-off static servers for an exported web build                             |

Several write PNGs to `./shots/` (gitignored; create it first). Passwords for
the seeded local accounts are read from `SEED_PASSWORD`, `TEST_PASSWORD` and
`SHARE_PASSWORD`, falling back to the values the seed script used. A few
expect a session cookie in `$COOKIE`.

`compose-privacy.mjs` / `compose-privacy.html` are the odd ones out: they build
the four-column Play data-safety comparison image, and that piece of work was
never finished — two label fixes were outstanding.
