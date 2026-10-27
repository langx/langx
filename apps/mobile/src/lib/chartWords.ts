/**
 * How `components/charts/BarList` writes a number and reads a row aloud when
 * its caller says nothing — which is the operator panel, in English by design
 * (`app/(app)/admin/**`). Here rather than in the component so a test can
 * hold the panel's output to exactly what it was before the chart learned to
 * speak a reader's language for the Transparency page.
 */

/** `12,345`: English grouping, whatever language the app is in. */
export function englishCount(value: number): string {
  return value.toLocaleString('en')
}

/** "Spanish: 12345, 4%" — the label, the bare number, and the hint when there is one. */
export function englishBarLabel(row: { label: string; value: number; hint?: string }): string {
  return `${row.label}: ${row.value}${row.hint ? `, ${row.hint}` : ''}`
}
