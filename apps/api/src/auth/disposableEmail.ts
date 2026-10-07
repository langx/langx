import { DISPOSABLE_DOMAINS } from './disposableDomains'

/**
 * Whether an address is on a known throwaway mail domain — the domain itself
 * or any subdomain of one, since several of these services hand out a fresh
 * subdomain per inbox.
 *
 * Each suffix of the domain is looked up in turn rather than working out the
 * registrable domain first: that would need the public-suffix list, and the
 * blocklist already names some entries below it (`x.dynv6.net` without
 * `dynv6.net`), which only a suffix walk matches exactly.
 */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  let domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
  while (domain.includes('.')) {
    if (DISPOSABLE_DOMAINS.has(domain)) return true
    domain = domain.slice(domain.indexOf('.') + 1)
  }
  return false
}
