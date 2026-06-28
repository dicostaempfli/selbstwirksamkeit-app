// Service Worker — Raum für Selbstwirksamkeit
// Version: 2026-06-28 18:25

const VERSION = '2026-06-28-1825';

// Bei Install: sofort aktivieren ohne auf alten SW zu warten
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Bei Activate: alle Clients übernehmen
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// SKIP_WAITING Message von index.html empfangen
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: index.html und root immer Network-first (nie gecacht)
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isHTML = url.endsWith('/') || url.endsWith('/index.html') || url.endsWith('selbstwirksamkeit-app/');
  if(isHTML) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Alle anderen Requests: normal durchlassen (kein Caching)
});

// Push Notifications
self.addEventListener('push', e => {
  let data = { title: 'Raum für Selbstwirksamkeit', body: 'Du hast eine neue Nachricht.', tag: 'default', url: './' };
  try { if(e.data) data = { ...data, ...e.data.json() }; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: data.url },
      vibrate: [100, 50, 100],
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Absolute URL bauen statt relativem Pfad: ein relativer Pfad wie "#chat" würde sich
  // sonst auf die zuletzt bekannte URL des fokussierten Clients beziehen — z.B. fälschlich
  // sw.js#chat, falls irgendein Tab zuvor sw.js direkt angezeigt hat (Service-Worker-Scope
  // gilt für die ganze Origin, nicht nur für Tabs, die index.html zeigten).
  const relPath = e.notification.data?.url || './';
  const absoluteUrl = new URL(relPath, self.registration.scope).href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for(const client of windowClients) {
        if('focus' in client) {
          if('navigate' in client) client.navigate(absoluteUrl).catch(()=>{});
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(absoluteUrl);
    })
  );
});
