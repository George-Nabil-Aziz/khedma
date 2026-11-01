// Loaded into the app's service worker (vite.config.ts → workbox.importScripts).
// Shows the birthday notifications sent by the khedma-birthdays Edge Function, and opens the
// app on the child's page (or the children list) when one is tapped.

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'فصلي', {
      body: data.body || '',
      tag: data.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      lang: 'ar',
      dir: 'auto',
      data: { url: data.url || '#/' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '#/', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // the app is already open: bring it to the front on that page
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
