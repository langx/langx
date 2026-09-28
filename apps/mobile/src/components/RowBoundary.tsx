import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Draws nothing in place of one list row that threw while rendering.
 *
 * The notification centre is a list of rows the server wrote, and a list is
 * only as sturdy as its worst row: in 2.7 one row of a kind the build did not
 * know threw inside the render, and with nothing above it to catch the throw
 * the screen went, and the app with it. Everything the row needs is already
 * checked before it is drawn (`isDrawableRow`, the `default` of every
 * `switch`); this is for whatever those did not think of, and the cost of
 * being wrong is one missing row rather than the screen.
 *
 * A class because React still offers no other way to catch a render error.
 * Nothing is shown and nothing is said: a row that cannot be drawn has no
 * sentence to put in its place, and an error line in a list of news is worse
 * than a gap. React still logs the error in development.
 */
export class RowBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
