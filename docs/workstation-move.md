# Moving to another machine

Every `langx/*` repo is public, so a handful of working files are deliberately
kept in no repository at all. Cloning the repos brings back the code; this
page lists what a clone does **not** bring, so a machine change does not lose
it again. It happened once: a server was decommissioned and the only copies of
its Claude memory and its verification scripts were rescued by hand at the
last minute.

Names only, never values. Nothing on this page is a secret; the files it names
are.

## 1. Check out the repos side by side

The docs assume one parent folder with the sibling checkouts next to this one
(see [`repo-map.md`](repo-map.md)):

```bash
mkdir langx-workspace && cd langx-workspace
for r in langx website token-website docs api; do git clone https://github.com/langx/$r; done
cd langx && pnpm install
```

`api` is read-only (see the repo map) but the docs and `token-website` still
point at it, so keep the checkout.

## 2. Files that travel by hand

| Where                                   | What                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| `langx/.env`                            | development profile — see `.env.example`                             |
| `langx/.env.prod`                       | the production overlay used by the scripts                           |
| `apps/mobile/.env`                      | Expo public config for the mobile app                                |
| `langx/atlas-credentials.env`           | MongoDB Atlas download; matched by `*.env` in `.gitignore`           |
| `langx/.claude/settings.local.json`     | per-machine Claude Code permissions; ignored by the global gitignore |
| `api/.env`                              | v1 API — read-only, but the deploy still needs it                    |
| a Google Translate service-account JSON | referenced from `langx/.env`; keep it outside every checkout         |
| the Discord server tooling folder       | holds a fully privileged bot token in its own `.env`; never a repo   |
| what was salvaged from the old server   | credentials inside; bring it if still wanted, otherwise leave it     |

Copy them with `scp`/`rsync` **into the same relative places**, then run
`git status` in every checkout: each must still report a clean tree. A
credential file showing up as untracked means an ignore rule did not match its
name — fix the rule before doing anything else.

## 3. Claude Code's memory

Claude keys its memory by the absolute path of the folder a session starts in.
For sessions started in this repo the directory is

```
~/.claude/projects/<home path with / replaced by ->-Developer-langx-langx/memory/
```

for example `-Users-xl-Developer-langx-langx` on a Mac and
`-home-xl-Developer-langx-langx` on a Linux box. Copy the whole `memory/`
directory to the **new** path — the segment changes with the home directory,
so a straight copy of `~/.claude` lands in a folder Claude never reads.
`MEMORY.md` inside it is the index; one line per file.

Start `claude` from inside `langx/`, not from the parent folder. The parent has
no `CLAUDE.md` any more; this repo's is the instruction.

## 4. Backups are not working files

Raw backups (the v1 source copy, the object-storage dump) do not belong on the
working machine. Leave them where they are, or in the storage bucket, and note
where in the repo map if the location changes.

## 5. After the move

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

Then open the dev servers from `.claude/launch.json` (`langx-api`,
`langx-mobile`, and `website` if the sibling checkout is there). Local MongoDB
must be a replica set — see [`self-host.md`](self-host.md).
