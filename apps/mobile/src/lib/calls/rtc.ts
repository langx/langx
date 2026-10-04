import { MediaAccessError, type CallEngine } from './engine'

/**
 * The media engine on a phone — which, in this build, there is not one of.
 *
 * Carrying a call on iOS or Android takes a native WebRTC module, and a native
 * module is not something an over-the-air update can add: it changes the
 * build itself, and arrives with a store release. Until it does, this says so,
 * and everything downstream follows from that one answer — no capability is
 * declared on the socket, the server never rings this phone, and the chat
 * header draws no call button. The call rows other people's calls leave in a
 * thread are drawn all the same; they are just messages.
 *
 * `rtc.web.ts` is the real engine, for browsers. Metro resolves that file on
 * the web and this one everywhere else.
 */
export const engine: CallEngine = {
  supported: () => false,
  acquire: () => Promise.reject(new MediaAccessError('microphone')),
  open: () => {
    throw new Error('This build has no media engine')
  },
}
