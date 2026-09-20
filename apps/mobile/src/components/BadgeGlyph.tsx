import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

/**
 * The catalogue's glyph, from whichever set it names. `mci:` in front means
 * MaterialCommunityIcons; everything else is Feather.
 *
 * The casts are the price of a name that arrives as data. Both libraries type
 * `name` as a union of their own glyphs and neither exports a runtime guard;
 * `badgeGlyph.test.ts` checks every name in `BADGES` against the shipped maps
 * instead, which catches the only thing the union would have.
 *
 * Its own file since the profile's strip started drawing the same marks as the
 * badge page: two components, one rule about what `mci:` means.
 */
export function BadgeGlyph({
  icon,
  color,
  size = 22,
}: {
  icon: string
  color: string
  size?: number
}) {
  if (icon.startsWith('mci:')) {
    const name = icon.slice(4) as React.ComponentProps<typeof MaterialCommunityIcons>['name']
    return <MaterialCommunityIcons name={name} size={size} color={color} />
  }
  return (
    <Feather
      name={icon as React.ComponentProps<typeof Feather>['name']}
      size={size}
      color={color}
    />
  )
}
