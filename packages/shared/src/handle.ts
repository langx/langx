import { z } from 'zod'

/**
 * 3-20 chars, lowercase letters/digits/underscore, must start with a letter —
 * permissive enough to fit v1's existing handles (so legacy claims don't get
 * rejected by a format check the old system never enforced this strictly),
 * strict enough to stay URL- and mention-safe.
 */
const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    HANDLE_PATTERN,
    'Handle must be 3-20 characters: letters, numbers, underscore, starting with a letter',
  )

export type Handle = z.infer<typeof handleSchema>
