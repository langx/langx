/**
 * How the Echo review submit treats a phone with no network: it sends anyway,
 * and fails.
 *
 * Not the library's default. `queryNetwork.ts` tells TanStack what the radio
 * is doing, and under the default mode, `online`, a mutation started offline
 * is *paused*: its promise neither resolves nor rejects until the network
 * returns. The session's catch is what writes the grades to the device, so
 * it never ran. A second session opened offline drew the same cards again,
 * both paused batches went out with different review ids when the network
 * came back (each card moved twice), and an app killed offline lost them.
 *
 * Failing fast lets the device file do the waiting, which survives a kill and
 * which the tab flushes once. This submit only; the rest of the app keeps the
 * default.
 */
export const ECHO_SUBMIT_NETWORK_MODE = 'always' as const
