import { buttonsSection } from './ButtonsSection'
import { colorsSection } from './ColorsSection'
import { elevationSection } from './ElevationSection'
import { gamificationSection } from './GamificationSection'
import type { GallerySectionEntry } from './GallerySection'
import { huesSection } from './HuesSection'
import { iconsSection } from './IconsSection'
import { motionSection } from './MotionSection'
import { radiiSection } from './RadiiSection'
import { spacingSection } from './SpacingSection'
import { typeSection } from './TypeSection'

/**
 * The design gallery, top to bottom.
 *
 * **To add a section:** write `src/components/gallery/<Name>Section.tsx`
 * exporting a `GallerySectionEntry`, with its labels in
 * `ADMIN.gallery` (`src/lib/adminStrings.ts`) and any copy a person would
 * read in `GallerySamples.tsx`, then add it to this list. The screen renders
 * whatever is here and needs no change.
 */
export const GALLERY_SECTIONS: readonly GallerySectionEntry[] = [
  colorsSection,
  huesSection,
  typeSection,
  radiiSection,
  spacingSection,
  iconsSection,
  elevationSection,
  motionSection,
  buttonsSection,
  gamificationSection,
]
