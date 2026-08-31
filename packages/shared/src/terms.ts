/**
 * The version of the terms a new account is agreeing to.
 *
 * A date, because that is how the published documents are identified and
 * because a number would need its own changelog to mean anything. Bump it when
 * the text at `langx.io/terms-conditions` or the privacy policy changes in a
 * way that would need re-consent — and only then, since every account stamped
 * with an older version is, by definition, a person who has not seen the new
 * one.
 *
 * In shared rather than on the server so the client can eventually compare what
 * somebody accepted against what is current, which is the only way to ask for
 * consent again without asking everybody.
 */
export const CURRENT_TERMS_VERSION = '2026-08-31'
