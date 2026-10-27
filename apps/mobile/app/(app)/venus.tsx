import { VenusScreenV3 } from '../../src/screens/VenusScreenV3'

/**
 * Venus's page — one of the product pages, which exist in the redesign only:
 * there is no older look of it to fall back to with `flags.v3Home` off.
 */
export default function VenusScreenRoute() {
  return <VenusScreenV3 />
}
