# Security Policy

## Supported versions

Only `main` receives security updates; every store build, the web app and the
API are cut from it. `langx-angular` and the other archived repositories do not.

| Component                               | Supported          |
| --------------------------------------- | ------------------ |
| `main`                                  | :white_check_mark: |
| Archived repos (`langx-angular`, `api`) | :x:                |

## Reporting a vulnerability

Email <hi@langx.io>. Please do not open a public issue for anything exploitable.

You can expect an update within a week. We will evaluate the report and tell you
whether it is accepted, and if so, ship a fix in the next security update. If it
is declined we will explain why.

## Notes for contributors

This repository is public and the API is open source. Two consequences shape how
we review security-relevant changes:

- **No secrets in the repo.** Every credential lives in `.env` (git-ignored) or
  the platform secret store. `.env.example` carries placeholder keys only.
  Anything prefixed `EXPO_PUBLIC_` is compiled into the client bundle and is
  world-readable — never put a secret behind that prefix.
- **No security through obscurity.** Quota limits, entitlement checks and token
  anti-abuse thresholds are all readable in this repository. That is fine, and
  it is why every one of them is enforced server-side with atomic writes and
  idempotency keys rather than by hiding the rule. A change that moves an
  authorization or quota decision to the client is a security bug, not a
  refactor.
