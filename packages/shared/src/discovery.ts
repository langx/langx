import { cefrLevelSchema } from './cefr'
import { languageCodeSchema } from './languages'
import { genderSchema } from './profile'
import { z } from 'zod'

/**
 * v1 offered five discovery tabs (For You / Enthusiasts / New Users / Active /
 * Visitors). v2's MVP collapses that to two sort presets over one aggregation
 * — "recommended" (scored) and "active" (`stats.lastActiveAt desc`, the same
 * field the discovery indexes are already built on). "New Users" would need a
 * fresh `createdAt` index and "Enthusiasts" depends on the badge system —
 * both P1. Visitors already exists separately as `profileViews` (Pro).
 */
export const DISCOVERY_SORTS = ['recommended', 'active'] as const
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number]
export const discoverySortSchema = z.enum(DISCOVERY_SORTS)

export const DISCOVERY_PAGE_SIZE_DEFAULT = 20
export const DISCOVERY_PAGE_SIZE_MAX = 50

/** A profile counts as "online now" for the free `online` filter within this window. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000

/**
 * Keys that require Pro (`PLAN_LIMITS.advancedFilters`). A free account
 * sending any of these gets `403 UPGRADE_REQUIRED`, not a silently-ignored
 * parameter — see "Paywall kuralları" in the plan.
 */
export const DISCOVERY_PRO_FILTER_KEYS = [
  'gender',
  'country',
  'minLevel',
  'ageMin',
  'ageMax',
] as const

export const discoveryQuerySchema = z
  .object({
    sort: discoverySortSchema.default('recommended'),
    /** Opaque token from the previous page's `nextCursor`. Never parse it client-side. */
    cursor: z.string().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(DISCOVERY_PAGE_SIZE_MAX)
      .default(DISCOVERY_PAGE_SIZE_DEFAULT),
    /** Free filter: narrow to one specific language out of the viewer's own learning list. */
    targetLanguage: languageCodeSchema.optional(),
    /** Free filter: only profiles active within {@link ONLINE_WINDOW_MS}. */
    online: z.coerce.boolean().optional(),
    // Pro-only from here down.
    gender: genderSchema.optional(),
    country: z.string().trim().min(1).max(2).optional(),
    minLevel: cefrLevelSchema.optional(),
    ageMin: z.coerce.number().int().min(18).optional(),
    ageMax: z.coerce.number().int().min(18).optional(),
  })
  .refine((q) => q.ageMin === undefined || q.ageMax === undefined || q.ageMin <= q.ageMax, {
    message: 'ageMin cannot exceed ageMax',
    path: ['ageMin'],
  })

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>

export const discoveryItemSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  country: z.string().optional(),
  gender: genderSchema,
  age: z.number().int(),
  nativeLanguages: z.array(z.object({ code: languageCodeSchema })),
  learning: z.array(
    z.object({ code: languageCodeSchema, level: cefrLevelSchema, priority: z.number() }),
  ),
  isOnline: z.boolean(),
  streak: z.object({ current: z.number().int() }),
})
export type DiscoveryItem = z.infer<typeof discoveryItemSchema>

export const discoveryPageSchema = z.object({
  items: z.array(discoveryItemSchema),
  nextCursor: z.string().nullable(),
})
export type DiscoveryPage = z.infer<typeof discoveryPageSchema>
