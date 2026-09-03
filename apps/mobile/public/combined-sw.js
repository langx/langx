/**
 * Kill switch for the service worker v1 left behind on app.langx.io.
 *
 * v1 was an Angular PWA and registered a worker under this name on the same
 * origin the v2 web build now lives on. A browser that visited v1 still has
 * that worker installed, and a worker answers navigations from its own cache
 * before the network is consulted — so the person sees the old app shell,
 * and sees it again on every reload, however many times the server behind it
 * has changed.
 *
 * A 404 for the script would eventually clear the registration on an update
 * check, but the old shell keeps being served until that check succeeds and
 * the page is opened once more. This file is what the update check fetches
 * instead: it takes over immediately, drops every cache, unregisters itself,
 * and reloads every open tab, which then hits the network and gets v2.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) client.navigate(client.url)
    })(),
  )
})
