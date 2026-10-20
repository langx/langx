import { useId, type ComponentType, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, G, Path, Rect, Text as SvgText, TextPath } from 'react-native-svg'
import {
  cutFor,
  frameArtNodes,
  HELLO_RING,
  type ArtCut,
  type ArtNode,
  type ArtScheme,
} from '../../lib/frameArt/geometry'
import type { ArtKey } from '../../lib/frameArt/palettes'
import { DISPLAY_FONT } from '../../lib/theme'

/** The drawing's box, in units: the avatar's radius is 48 of them. */
const VIEW_BOX = '-72 -72 144 144'
/** How much wider than the avatar the drawing's box is (144 / 96). */
const BOX_SCALE = 1.5
/**
 * The room `Avatar` keeps around a face of `size`: to the outside of the
 * widest band (Aurora Glass's 65 units). The break-outs — the hoop's clamp,
 * the seal, the glass's halo — overflow it by design, as they do on the sheet.
 */
export function frameArtBox(size: number): number {
  return Math.round((size * 65) / 48)
}

/**
 * What draws Aurora Glass's sweep. Passed in rather than imported: it runs on
 * Reanimated, and `Avatar` is on the launch path (the onboarding photo step),
 * which stays off Reanimated — see `lib/theme/motion.ts`. The two places the
 * sweep runs import it themselves.
 */
export type FrameSweepComponent = ComponentType<{ box: number; children: ReactNode }>

const cache = new Map<string, ArtNode[]>()
function nodesFor(art: ArtKey, cut: ArtCut, scheme: ArtScheme): ArtNode[] {
  const key = `${art}:${cut}:${scheme}`
  let nodes = cache.get(key)
  if (!nodes) {
    nodes = frameArtNodes(art, cut, scheme)
    cache.set(key, nodes)
  }
  return nodes
}

function draw(nodes: readonly ArtNode[], helloId: string): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.el) {
      case 'path':
        return <Path key={i} {...node.a} />
      case 'circle':
        return <Circle key={i} {...node.a} />
      case 'rect':
        return <Rect key={i} {...node.a} />
      case 'g':
        return (
          <G key={i} transform={String(node.a.transform)}>
            {draw(node.kids, helloId)}
          </G>
        )
      case 'hello':
        return (
          <G key={i}>
            <Defs>
              <Path id={helloId} d={`M0 -${node.r} A${node.r} ${node.r} 0 1 1 -0.01 -${node.r}`} />
            </Defs>
            <SvgText
              fontFamily={DISPLAY_FONT}
              fontWeight="800"
              fontSize={node.fontSize}
              fill={node.fill}
            >
              <TextPath
                href={`#${helloId}`}
                textLength={node.length}
                lengthAdjust="spacingAndGlyphs"
              >
                {HELLO_RING}
              </TextPath>
            </SvgText>
          </G>
        )
    }
  })
}

interface FrameArtProps {
  art: ArtKey
  /** The avatar's own size; the cut is picked from it. */
  size: number
  scheme: ArtScheme
  sweep?: FrameSweepComponent | undefined
}

/**
 * A frame drawn as art around an avatar of `size`, from the v3 master sheet:
 * see `lib/frameArt/geometry.ts`. Absolutely placed and centred on its parent,
 * which `Avatar` sizes to `FRAME_ART_SCALE` times the face, and drawn beneath
 * the face, as on the sheet.
 *
 * Purely decorative to a screen reader — the avatar beside it carries the
 * name, and the frame's name is in the store.
 */
export function FrameArt({ art, size, scheme, sweep: Sweep }: FrameArtProps) {
  const helloId = `hello${useId().replace(/:/g, '')}`
  const nodes = nodesFor(art, cutFor(size), scheme)
  const box = size * BOX_SCALE
  // Only Aurora Glass at the full cut has a highlight to move. Without a
  // sweep to move it, it is drawn where it rests, at 30°.
  const moving = Sweep ? nodes.filter((n) => n.el !== 'g' && n.el !== 'hello' && n.sweep) : []
  const still = moving.length > 0 ? nodes.filter((n) => !moving.includes(n)) : nodes
  // Every side the same inset, so the drawing is centred on the face in
  // either direction of writing: negative, since the drawing's box is wider
  // than the room `Avatar` keeps for it.
  const inset = (frameArtBox(size) - box) / 2

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { top: inset, bottom: inset, start: inset, end: inset }]}
    >
      <Svg width={box} height={box} viewBox={VIEW_BOX}>
        {draw(still, helloId)}
      </Svg>
      {Sweep && moving.length > 0 ? (
        <Sweep box={box}>
          <Svg width={box} height={box} viewBox={VIEW_BOX}>
            {draw(moving, helloId)}
          </Svg>
        </Sweep>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { overflow: 'visible', position: 'absolute' },
})
