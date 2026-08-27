import { ERROR_CODES } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { ApiError } from './ApiError'

/**
 * Keyset pagination token for collections sorted `{<dateField>: -1, _id: -1}`
 * where `_id` is a real `ObjectId` — messages and conversations both page
 * this way. A plain `createdAt`-only cursor can skip or repeat rows when two
 * documents share a millisecond; the `_id` tiebreak is what makes the page
 * boundary exact.
 */
export function encodeDateIdCursor(date: Date, id: ObjectId): string {
  return `${date.toISOString()}|${id.toHexString()}`
}

export function decodeDateIdCursor(cursor: string): { date: Date; id: ObjectId } {
  const [iso, idHex] = cursor.split('|')
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime()) || !idHex) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
  try {
    return { date, id: new ObjectId(idHex) }
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
}
