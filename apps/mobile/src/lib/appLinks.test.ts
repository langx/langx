import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANDROID_CERT_SHA256, ANDROID_PACKAGE, IOS_APP_ID } from '@langx/shared'
import { describe, expect, it } from 'vitest'

/**
 * The two association files are the whole of Android App Link and iOS
 * Universal Link verification, and they fail *quietly*: a wrong bundle
 * identifier or a stale fingerprint does not break a build or throw at
 * runtime, it just means every `https://app.langx.io/...` link opens the
 * browser instead of the app, on every device, until someone notices.
 *
 * They are also plain JSON served to Apple and Google, so they cannot import
 * the constants they have to agree with. This test is the join.
 */
const WELL_KNOWN = join(import.meta.dirname, '../../public/.well-known')

function read(name: string): unknown {
  return JSON.parse(readFileSync(join(WELL_KNOWN, name), 'utf8'))
}

describe('apple-app-site-association', () => {
  // Apple fetches this over TLS and parses it as JSON despite the missing
  // extension; a stray comma is a silent total failure.
  const aasa = read('apple-app-site-association') as {
    applinks: { details: { appIDs: string[]; components: { '/': string; exclude?: boolean }[] }[] }
    webcredentials: { apps: string[] }
  }

  it('claims the app ID Apple actually signs', () => {
    expect(aasa.applinks.details[0]?.appIDs).toEqual([IOS_APP_ID])
  })

  it('associates the same app for password autofill', () => {
    // Without this the sign-in form's `textContentType` prompts iCloud
    // Keychain for a password saved against a *different* identity, so it
    // offers nothing.
    expect(aasa.webcredentials.apps).toEqual([IOS_APP_ID])
  })

  it('excludes the association files before matching everything else', () => {
    // Order is significant: Apple takes the first matching component, so a
    // catch-all placed first would swallow the exclusion.
    const components = aasa.applinks.details[0]?.components ?? []
    expect(components[0]).toMatchObject({ '/': '/.well-known/*', exclude: true })
    expect(components.at(-1)).toMatchObject({ '/': '/*' })
    expect(components.at(-1)).not.toHaveProperty('exclude')
  })
})

describe('assetlinks.json', () => {
  const statements = read('assetlinks.json') as {
    relation: string[]
    target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] }
  }[]

  it('delegates to the package name the store already knows', () => {
    expect(statements[0]?.target).toMatchObject({
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
    })
  })

  it('lists the same fingerprints as the shared constant', () => {
    // Empty on both sides today. The constant is where the value is documented
    // and where the release runbook sends you; this keeps the served file from
    // drifting away from it once it is filled in.
    expect(statements[0]?.target.sha256_cert_fingerprints).toEqual([...ANDROID_CERT_SHA256])
  })

  it('uses fingerprints in the format Google publishes them', () => {
    for (const fingerprint of ANDROID_CERT_SHA256) {
      // Play Console gives colon-separated uppercase hex. Lowercase or
      // colon-stripped forms are rejected without comment.
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    }
  })
})
