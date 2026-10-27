import { CopilotScreenV3 } from '../../src/screens/CopilotScreenV3'

/**
 * The Copilot page. Drawn in the redesign's look whatever `flags.v3Home`
 * says, as every product page is: the family exists only in that look, and
 * the page's own action already knows when the thread behind it draws no
 * Copilot (`copilotPageAction`).
 */
export default function CopilotRoute() {
  return <CopilotScreenV3 />
}
