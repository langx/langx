import { View } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import { cutFor, patchNodes, type PatchState } from '../../lib/badgePatch/geometry'
import { useTheme } from '../../lib/theme'

const EARNED: PatchState = { kind: 'earned' }

/**
 * A badge drawn as its embroidered patch, the v3 badge art: see
 * `lib/badgePatch/geometry.ts`.
 *
 * Found by `id`, for the reason `BadgeMark` is: what this build draws depends
 * only on this build. An id it does not know draws the empty hoop, keeping the
 * space without inventing a face.
 *
 * Drawn with react-native-svg like `FrameArt`, and plain — no Reanimated —
 * so a profile row of three patches costs three static drawings. The one
 * moving part, the earned moment's stitch, is `BadgeStitch`, laid over this.
 *
 * Purely decorative to a screen reader: every place that draws one names the
 * badge beside it.
 */
export function BadgePatch({
  id,
  size,
  state = EARNED,
}: {
  id: string
  size: number
  state?: PatchState
}) {
  const { scheme } = useTheme()
  const nodes = patchNodes(id, cutFor(size), state, scheme)
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: size, width: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {nodes.map((node, i) => {
          const path = (
            <Path
              key={i}
              d={node.d}
              fill={node.fill}
              stroke={node.stroke}
              strokeWidth={node.strokeWidth}
              {...(node.dash ? { strokeDasharray: node.dash } : {})}
              strokeLinecap={node.cap}
              strokeLinejoin="round"
              opacity={node.opacity}
            />
          )
          // On a group rather than the path: react-native-svg's web build
          // drops a transform string on a `Path`, and `FrameArt` draws its
          // transforms the same way.
          return node.transform ? (
            <G key={i} transform={node.transform}>
              {path}
            </G>
          ) : (
            path
          )
        })}
      </Svg>
    </View>
  )
}
