/*
 * Two private-use characters: nothing a translator writes and no store price
 * string contains them, so they can ride through `t()` as part of a value and
 * be found again afterwards.
 */
const OPEN = '\uE000'
const CLOSE = '\uE001'

/** One stretch of a sentence, set in the sentence's own weight or the strong one. */
export interface TextRun {
  text: string
  strong: boolean
}

/**
 * Marks a placeholder's value to be set in the strong weight once the
 * sentence around it is translated.
 *
 * The alternative — translating the words either side of the value as
 * separate strings — breaks in any language that orders them differently:
 * Turkish puts the period before the price ("yılda ₺1.799,99"), and a
 * sentence assembled from fragments cannot. This keeps one string per
 * sentence and lets each locale put the value where it belongs.
 */
export function emphasise(value: string): string {
  return `${OPEN}${value}${CLOSE}`
}

/**
 * Splits a translated sentence back into runs at the values `emphasise`
 * marked. A sentence with no marks is one plain run; a mark that was never
 * closed reads as plain text rather than swallowing the rest of the line.
 */
export function emphasisRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  const push = (part: string, strong: boolean) => {
    if (part) runs.push({ text: part, strong })
  }
  const [head = '', ...marked] = text.split(OPEN)
  push(head, false)
  for (const part of marked) {
    const end = part.indexOf(CLOSE)
    if (end < 0) {
      push(part, false)
      continue
    }
    push(part.slice(0, end), true)
    push(part.slice(end + CLOSE.length), false)
  }
  return runs
}
