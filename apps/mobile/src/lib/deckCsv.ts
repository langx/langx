import type { PhraseCardDto } from '../api/queries'

/**
 * A conversation's deck, as the file Anki imports.
 *
 * Plain CSV rather than an `.apkg`: Anki's own package format is a SQLite
 * database with a media archive, which would mean shipping a database writer
 * to build a file most people open once. Its importer reads CSV — term,
 * meaning, example — and so does every spreadsheet and every other flashcard
 * app, which is the point of exporting at all.
 *
 * Pure, so the tests can reach it. The file writing and the share sheet are
 * `saveDeckCsv`, and none of the interesting part is in them.
 */

/**
 * RFC 4180 quoting, which is not optional here.
 *
 * A phrase is somebody's sentence: it will contain commas, it will contain
 * quotation marks, and a multi-line example is ordinary. Each of the three
 * ends a field or a row if it is written raw, and the failure is silent —
 * Anki imports the wreckage rather than refusing it.
 */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function deckCsv(cards: readonly PhraseCardDto[]): string {
  // No header row: Anki's importer maps columns by position and treats a
  // header as a card, so a named one arrives as a phrase meaning "Term".
  const rows = cards.map((card) =>
    [card.term, card.meaning, card.example ?? ''].map(cell).join(','),
  )
  // CRLF, per RFC 4180 — and it is what Excel expects on Windows, which is
  // where a file like this most often lands next.
  return rows.length > 0 ? `${rows.join('\r\n')}\r\n` : ''
}
