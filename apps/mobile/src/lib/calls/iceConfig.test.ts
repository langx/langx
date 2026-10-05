import type { IceConfig } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { iceConfigFor } from './iceConfig'

const relay: IceConfig = {
  iceTransportPolicy: 'relay',
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'u',
      credential: 'p',
    },
  ],
}

describe('iceConfigFor', () => {
  /** A browser refuses the whole configuration over one address on port 53. */
  it('takes the port a browser will not connect to out of the list', () => {
    const web = iceConfigFor(relay, 'web')
    expect(web.iceServers).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turns:turn.cloudflare.com:443?transport=tcp',
        ],
        username: 'u',
        credential: 'p',
      },
    ])
    expect(web.iceTransportPolicy).toBe('relay')
  })

  it('leaves a phone the whole list', () => {
    expect(iceConfigFor(relay, 'ios')).toBe(relay)
    expect(iceConfigFor(relay, 'android')).toBe(relay)
  })

  it('drops a server that had nothing but that port', () => {
    const only53: IceConfig = {
      iceTransportPolicy: 'all',
      iceServers: [{ urls: 'stun:stun.example.com:53' }, { urls: 'stun:stun.example.com:3478' }],
    }
    expect(iceConfigFor(only53, 'web').iceServers).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
    ])
  })

  it('does not mistake a 53 elsewhere in an address for the port', () => {
    const tricky: IceConfig = {
      iceTransportPolicy: 'all',
      iceServers: [{ urls: ['turn:host53.example.com:5349', 'turn:turn.example.com:5353'] }],
    }
    expect(iceConfigFor(tricky, 'web').iceServers[0]?.urls).toHaveLength(2)
  })
})
