import { MutationObserver, QueryClient, onlineManager } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { ECHO_SUBMIT_NETWORK_MODE } from './echoSubmitMode'

/*
 * What the session's catch depends on. With the library's default, `online`,
 * a mutation started with the radio off is paused rather than run: the
 * promise neither resolves nor rejects, so the session never reaches the
 * catch that writes its grades to the device. A second offline session then
 * drew the same cards (nothing pending), both paused batches sent with
 * different review ids when the network came back, and killing the app lost
 * them.
 */
describe('sending an Echo session with no network', () => {
  afterEach(() => onlineManager.setOnline(true))

  function sendOffline(networkMode?: 'always') {
    onlineManager.setOnline(false)
    const observer = new MutationObserver(new QueryClient(), {
      mutationFn: () => Promise.reject(new Error('Network request failed')),
      ...(networkMode ? { networkMode } : {}),
    })
    const settled = observer.mutate(undefined).then(
      () => 'resolved',
      () => 'rejected',
    )
    const later = new Promise((resolve) => setTimeout(() => resolve('still waiting'), 50))
    return Promise.race([settled, later])
  }

  it('is paused, never failed, under the default mode', async () => {
    expect(await sendOffline()).toBe('still waiting')
  })

  it('fails at once under the mode the submit uses, so the grades are kept', async () => {
    expect(await sendOffline(ECHO_SUBMIT_NETWORK_MODE)).toBe('rejected')
  })
})
