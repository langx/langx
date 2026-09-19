import { readCompanionSnapshot } from '../modules/companion-snapshot'
import { renderFor, WIDGET_NAMES, type WidgetName } from './CompanionWidget'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'

/**
 * What Android calls when a widget needs drawing.
 *
 * It runs in a headless JS task — the app's own bundle, with no screen and no
 * session — so everything it needs has to already be on the device.
 * `readCompanionSnapshot` is that: the blob the app wrote the last time it had
 * an answer. Nothing here fetches, which is the whole design and not a
 * shortcut; see the note on `companionSnapshotSchema`.
 *
 * `WIDGET_CLICK` is absent on purpose. Every tap in these widgets is an
 * `OPEN_URI` that the system handles by opening the deep link itself, so there
 * is no action for this handler to take — and adding one would be the first
 * step towards a widget that *acts*, which Phase 1 ruled out.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const name = props.widgetInfo.widgetName as WidgetName
  if (name !== WIDGET_NAMES.streak && name !== WIDGET_NAMES.summary) return

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderFor(name, await readCompanionSnapshot()))
      break
    default:
      break
  }
}
