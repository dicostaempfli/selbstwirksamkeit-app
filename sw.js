// Service Worker — Raum für Selbstwirksamkeit
// Version: 2026-06-03

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

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
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for(const client of windowClients) {
        if('focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
