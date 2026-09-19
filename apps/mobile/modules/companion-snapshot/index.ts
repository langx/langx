import { type CompanionSnapshot } from '@langx/shared'
import { requireOptionalNativeModule } from 'expo'

/**
 * The one door between the app and the iOS widgets.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`: this module
 * exists only on iOS, and only in a build made since it was added. Android,
 * the web build and any older binary running a newer JS bundle over the air
 * all get `null` here, and every call below becomes a no-op — so call sites
 * stay unconditional and nothing has to know which platform it is on.
 *
 * The snapshot is serialised here and stored as a string. The shape lives in
 * `packages/shared/src/companion.ts` and is decoded again in Swift by the
 * widget; keeping the encoding on this side means the Swift half only has to
 * agree with the schema, not with a second copy of it.
 */
interface CompanionSnapshotNativeModule {
  write: (json: string) => void
  clear: () => void
}

const native = requireOptionalNativeModule<CompanionSnapshotNativeModule>('CompanionSnapshot')

/** Hand the widgets a fresh reading. */
export function writeCompanionSnapshot(snapshot: CompanionSnapshot): void {
  native?.write(JSON.stringify(snapshot))
}

/**
 * Forget everything. Called on sign-out, in the same breath as the session:
 * a widget that goes on showing somebody's streak after they sign out is their
 * data left on a Home Screen that may not be theirs.
 */
export function clearCompanionSnapshot(): void {
  native?.clear()
}
