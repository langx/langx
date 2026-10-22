import type { TranslateFn } from '../i18n/runtime'

/**
 * What the back field of a card's form is called.
 *
 * Usually "What it means": the back is the sentence's meaning in the reader's
 * own language. Not on a card whose back is in a language being learned
 * (`backLang`, #1941) — a sentence kept in their own language, its back how to
 * say it in the one they learn. Labelled "What it means", that back read as a
 * wrong translation: the English line sitting where a Spanish speaker expects
 * their own.
 */
export function echoBackLabel(
  t: TranslateFn,
  languageName: (code: string) => string,
  backLang: string | undefined,
): string {
  return backLang ? t('echo.editBackIn', { language: languageName(backLang) }) : t('echo.editBack')
}
